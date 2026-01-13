import React, { useState, useEffect } from 'react';
import { MdDeleteOutline } from "react-icons/md";
import emailjs from '@emailjs/browser';

const AdminDashboard = () => {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [pendingResets, setPendingResets] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [employeeTimesheets, setEmployeeTimesheets] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showEmployeePopup, setShowEmployeePopup] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const token = localStorage.getItem('token');

  useEffect(() => {
    emailjs.init('7GYBQXMTl3qKogPnT');
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setIsLoading(true);
      
      const [usersRes, resetsRes, pendingUsersRes, timesheetsRes] = await Promise.all([
        fetch('http://localhost:5000/api/auth/all-users', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('http://localhost:5000/api/auth/pending-resets', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('http://localhost:5000/api/auth/pending-users', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('http://localhost:5000/api/timesheet/employee-timesheets', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (usersRes.ok) setAllUsers(await usersRes.json());
      if (resetsRes.ok) setPendingResets(await resetsRes.json());
      if (pendingUsersRes.ok) setPendingUsers(await pendingUsersRes.json());
      if (timesheetsRes.ok) setEmployeeTimesheets(await timesheetsRes.json());
      
      setMessage({ text: 'Data refreshed successfully', type: 'success' });
    } catch (err) {
      setMessage({ text: 'Error fetching data', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEmployeeDetails = async (empId) => {
    try {
      setIsLoading(true);
      
      // Get user details
      const userResponse = await fetch(`http://localhost:5000/api/auth/user/${empId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!userResponse.ok) {
        throw new Error('Failed to fetch user details');
      }
      
      const userData = await userResponse.json();
      
      // Get all timesheets for this employee
      const timesheetResponse = await fetch(
        `http://localhost:5000/api/timesheet/employee-timesheets?search=${empId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      let timesheetData = [];
      if (timesheetResponse.ok) {
        timesheetData = await timesheetResponse.json();
      }
      
      // Get current month timesheet
      const currentDate = new Date();
      const currentMonth = currentDate.toLocaleString('default', { month: 'long' });
      const currentYear = currentDate.getFullYear();
      
      const currentTimesheet = timesheetData.find(ts => 
        ts.month === currentMonth && 
        ts.year === currentYear
      );
      
      // Get timesheet history (excluding current)
      const timesheetHistory = timesheetData.filter(ts => 
        !(ts.month === currentMonth && ts.year === currentYear)
      );
      
      setSelectedEmployee({
        employee: userData,
        currentTimesheet: currentTimesheet,
        timesheets: timesheetHistory,
      });
      
      setShowEmployeePopup(true);
      
    } catch (err) {
      setMessage({ text: 'Error fetching employee details', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const approveUser = async (pendingUser) => {
    try {
      setIsLoading(true);
      const res = await fetch(`http://localhost:5000/api/auth/approve-user/${pendingUser._id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'Approval failed');
      }

      // Send email notification
      const emailSent = await sendEmail('account_approval', {
        to_email: pendingUser.email,
        email: pendingUser.email,
        emp_id: pendingUser.empId,
        name: pendingUser.name || 'Employee',
        login_url: 'http://localhost:5173/login'
      });

      if (emailSent) {
        setMessage({ text: 'User approved and email sent!', type: 'success' });
      } else {
        setMessage({ text: 'User approved but email failed to send', type: 'warning' });
      }

      // Refresh data
      fetchAllData();
    } catch (err) {
      setMessage({ text: 'Error: ' + err.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const rejectUser = async (pendingUser) => {
    try {
      setIsLoading(true);
      const res = await fetch(`http://localhost:5000/api/auth/reject-user/${pendingUser._id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Rejection failed');

      // Send email notification
      const emailSent = await sendEmail('account_rejection', {
        to_email: pendingUser.email,
        email: pendingUser.email,
        emp_id: pendingUser.empId,
        name: pendingUser.name || 'Employee'
      });

      if (emailSent) {
        setMessage({ text: 'User rejected and email sent', type: 'success' });
      } else {
        setMessage({ text: 'User rejected but email failed to send', type: 'warning' });
      }

      fetchAllData();
    } catch (err) {
      setMessage({ text: 'Error rejecting user', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const sendEmail = async (templateName, templateParams) => {
    try {
      await emailjs.send('service_utmpn74', 'template_urixq6m', templateParams);
      return true;
    } catch (err) {
      console.error('Email sending failed:', err);
      return false;
    }
  };

  const getTotalHours = (timesheet) => {
    if (!timesheet?.days) return 0;
    return timesheet.days.reduce((total, day) => {
      const hours = parseFloat(day.totalLog) || 0;
      return total + hours;
    }, 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      const day = date.getDate();
      const month = date.toLocaleString('default', { month: 'short' });
      const year = date.getFullYear();
      return `${day} ${month} ${year}`;
    } catch {
      return 'Invalid date';
    }
  };

  const getEmployeeTimesheet = (empId) => {
    const currentDate = new Date();
    const currentMonth = currentDate.toLocaleString('default', { month: 'long' });
    const currentYear = currentDate.getFullYear();
    
    return employeeTimesheets.find(ts => 
      ts.employeeId === empId && 
      ts.month === currentMonth && 
      ts.year === currentYear
    );
  };

  const filteredUsers = allUsers.filter(user =>
    user.empId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ padding: '30px', maxWidth: '1600px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
     <div className='layout'>
  <nav style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px'
  }}>   
    <h1 style={{ color: '#0077b6' }}>Admin Dashboard - AROHAK</h1>
    
    <button 
      onClick={() => window.location.href = '/login'} 
      style={{
        padding: '10px 20px',
        backgroundColor: '#6c757d', 
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer'
      }}
    >
      Logout
    </button>
  </nav>
</div>
 
      {message.text && (
        <div style={{
          padding: '15px',
          marginBottom: '20px',
          backgroundColor: message.type === 'success' ? '#d4edda' :
                         message.type === 'error' ? '#f8d7da' :
                         message.type === 'warning' ? '#fff3cd' : '#f8f9fa',
          color: message.type === 'success' ? '#155724' :
                message.type === 'error' ? '#721c24' :
                message.type === 'warning' ? '#856404' : '#212529',
          border: `1px solid ${message.type === 'success' ? '#c3e6cb' :
                   message.type === 'error' ? '#f5c6cb' :
                   message.type === 'warning' ? '#ffeeba' : '#dee2e6'}`,
          borderRadius: '5px',
          fontWeight: '500'
        }}>
          {message.text}
        </div>
      )}

      {/* Main Layout */}
      <div style={{ display: 'flex', gap: '30px' }}>
        {/* Left Sidebar */}
        <div style={{ flex: '1' }}>
          {/* Pending Signup Requests */}
          <div style={{
            backgroundColor: '#fff',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            marginBottom: '20px'
          }}>
            <h2 style={{ color: '#495057', margin: '0 0 20px 0', fontSize: '18px' }}>
              Pending Signup Requests ({pendingUsers.length})
            </h2>
            
            {pendingUsers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#6c757d' }}>
                No pending requests
              </div>
            ) : (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {pendingUsers.map((user) => (
                  <div key={user._id} style={{
                    marginBottom: '15px',
                    padding: '15px',
                    border: '1px solid #e9ecef',
                    borderRadius: '5px',
                    backgroundColor: '#f8f9fa'
                  }}>
                    <p style={{ margin: '0 0 5px 0' }}><strong>EMP ID:</strong> {user.empId}</p>
                    <p style={{ margin: '0 0 5px 0' }}><strong>Name:</strong> {user.name || 'Not provided'}</p>
                    <p style={{ margin: '0 0 10px 0' }}><strong>Email:</strong> {user.email}</p>
                    <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#6c757d' }}>
                      Requested: {formatDate(user.createdAt)}
                    </p>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => approveUser(user)}
                        style={{
                          padding: '8px 15px',
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          flex: '1'
                        }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => rejectUser(user)}
                        style={{
                          padding: '8px 15px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          flex: '1'
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Password Resets */}
          <div style={{
            backgroundColor: '#fff',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ color: '#495057', margin: '0 0 20px 0', fontSize: '18px' }}>
              Pending Password Resets ({pendingResets.length})
            </h2>
            
            {pendingResets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#6c757d' }}>
                No pending resets
              </div>
            ) : (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {pendingResets.map((reset) => (
                  <div key={reset._id} style={{
                    marginBottom: '15px',
                    padding: '15px',
                    border: '1px solid #e9ecef',
                    borderRadius: '5px',
                    backgroundColor: '#f8f9fa'
                  }}>
                    <p style={{ margin: '0 0 5px 0' }}><strong>EMP ID:</strong> {reset.empId || 'N/A'}</p>
                    <p style={{ margin: '0 0 5px 0' }}><strong>Email:</strong> {reset.email || 'N/A'}</p>
                    <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#6c757d' }}>
                      Requested: {formatDate(reset.createdAt)}
                    </p>
                    <button
                      onClick={() => {
                        // Handle password reset approval
                        window.open(`http://localhost:5173/login?token=${reset.token}&action=reset`, '_blank');
                      }}
                      style={{
                        padding: '8px 15px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        width: '100%',
                        marginTop: '10px'
                      }}
                    >
                      Send Reset Link
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Section - Total Employees */}
        <div style={{ flex: '2' }}>
          <div style={{
            backgroundColor: '#fff',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            height: '100%'
          }}>
            {/* Header with Search and Refresh */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h2 style={{ color: '#495057', margin: 0, fontSize: '18px' }}>
                Total Employees ({allUsers.length})
              </h2>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      padding: '8px 12px 8px 35px',
                      borderRadius: '4px',
                      border: '1px solid #dee2e6',
                      fontSize: '14px',
                      width: '200px'
                    }}
                  />
                  <span style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#6c757d'
                  }}>
                    🔍
                  </span>
                </div>
                <button
                  onClick={fetchAllData}
                  disabled={isLoading}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#0077b6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  {isLoading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            </div>

            {/* Employee Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse',
                fontSize: '14px'
              }}>
                <thead>
                  <tr style={{ 
                    backgroundColor: '#f8f9fa',
                    borderBottom: '2px solid #dee2e6'
                  }}>
                    <th style={{ 
                      padding: '12px 15px', 
                      textAlign: 'left', 
                      fontWeight: '600',
                      color: '#495057',
                      borderBottom: '2px solid #dee2e6',
                      minWidth: '100px'
                    }}>EMPID</th>
                    <th style={{ 
                      padding: '12px 15px', 
                      textAlign: 'left', 
                      fontWeight: '600',
                      color: '#495057',
                      borderBottom: '2px solid #dee2e6',
                      minWidth: '120px'
                    }}>Name</th>
                    <th style={{ 
                      padding: '12px 15px', 
                      textAlign: 'left', 
                      fontWeight: '600',
                      color: '#495057',
                      borderBottom: '2px solid #dee2e6',
                      minWidth: '200px'
                    }}>Email</th>
                    <th style={{ 
                      padding: '12px 15px', 
                      textAlign: 'left', 
                      fontWeight: '600',
                      color: '#495057',
                      borderBottom: '2px solid #dee2e6',
                      minWidth: '120px'
                    }}>Project</th>
                    <th style={{ 
                      padding: '12px 15px', 
                      textAlign: 'left', 
                      fontWeight: '600',
                      color: '#495057',
                      borderBottom: '2px solid #dee2e6',
                      minWidth: '120px'
                    }}>Last Updated</th>
                    <th style={{ 
                      padding: '12px 15px', 
                      textAlign: 'left', 
                      fontWeight: '600',
                      color: '#495057',
                      borderBottom: '2px solid #dee2e6',
                      minWidth: '100px'
                    }}>Actions</th>
                    <th style={{ 
                      padding: '12px 15px', 
                      textAlign: 'left', 
                      fontWeight: '600',
                      color: '#495057',
                      borderBottom: '2px solid #dee2e6',
                      minWidth: '100px'
                    }}>Revoke</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>
                        Loading employee data...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                        {searchQuery ? 'No employees found' : 'No employees registered'}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const timesheet = getEmployeeTimesheet(user.empId);
                      
                      return (
                        <tr key={user._id} style={{ 
                          borderBottom: '1px solid #f8f9fa',
                          cursor: 'pointer',
                          ':hover': {
                            backgroundColor: '#f8f9fa'
                          }
                        }}>
                          <td style={{ 
                            padding: '12px 15px', 
                            fontWeight: '500',
                            color: '#0077b6'
                          }}>{user.empId}</td>
                          <td style={{ padding: '12px 15px' }}>{user.name}</td>
                          <td style={{ padding: '12px 15px' }}>{user.email}</td>
                          <td style={{ padding: '12px 15px' }}>
                            {timesheet?.projectDetails?.project || 'Not assigned'}
                          </td>
                          <td style={{ padding: '12px 15px', color: '#6c757d' }}>
                            {timesheet?.submittedAt 
                              ? formatDate(timesheet.submittedAt)
                              : 'Never'
                            }
                          </td>
                          <td style={{ padding: '12px 15px' }}>
                            <button
                              onClick={() => fetchEmployeeDetails(user.empId)}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#28a745',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '13px'
                              }}
                            >
                              View Details
                            </button>
                          </td>
                          <td>
                            <button
                              onClick={async () => {
                                try {
                                  setIsLoading(true);
                                  const res = await fetch(`http://localhost:5000/api/auth/revoke-user/${user._id}`, {
                                    method: 'DELETE',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      Authorization: `Bearer ${token}`,
                                    },
                                  });
                                  if (!res.ok) throw new Error('Revoke failed');
                                  setMessage({ text: 'User access revoked', type: 'success' });
                                  fetchAllData();
                                } catch (err) {
                                  setMessage({ text: 'Error revoking user', type: 'error' });
                                } finally {
                                  setIsLoading(false);
                                }
                              }}
                              style={{
                                padding: '6px 6px 0px 6px',
                                backgroundColor: 'none',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                
                              }}
                            >
                              <MdDeleteOutline />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Employee Details Popup */}
      {showEmployeePopup && selectedEmployee && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            maxWidth: '900px',
            width: '100%',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '25px'
            }}>
              <h2 style={{ color: '#0077b6', margin: 0 }}>
                Employee Details: {selectedEmployee.employee?.name}
              </h2>
              <button
                onClick={() => {
                  setShowEmployeePopup(false);
                  setSelectedEmployee(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: '#6c757d'
                }}
              >
                ✕
              </button>
            </div>
            
            {/* Employee Info */}
            <div style={{ marginBottom: '25px' }}>
              <h4 style={{ 
                color: '#495057', 
                marginBottom: '15px',
                paddingBottom: '8px',
                borderBottom: '2px solid #0077b6'
              }}>Employee Information</h4>
              <div style={{ 
                backgroundColor: '#f8f9fa', 
                padding: '20px', 
                borderRadius: '6px',
                border: '1px solid #e9ecef'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
                  <div><strong>EMP ID:</strong> {selectedEmployee.employee?.empId}</div>
                  <div><strong>Name:</strong> {selectedEmployee.employee?.name}</div>
                  <div><strong>Email:</strong> {selectedEmployee.employee?.email}</div>
                  <div><strong>Role:</strong> {selectedEmployee.employee?.role || 'user'}</div>
                  <div><strong>Registered:</strong> {formatDate(selectedEmployee.employee?.createdAt)}</div>
                </div>
              </div>
            </div>
            
            {/* Current Timesheet */}
            {selectedEmployee.currentTimesheet && (
              <div style={{ marginBottom: '25px' }}>
                <h4 style={{ 
                  color: '#495057', 
                  marginBottom: '15px',
                  paddingBottom: '8px',
                  borderBottom: '2px solid #0077b6'
                }}>Current Timesheet</h4>
                
                {/* Project Details */}
                {selectedEmployee.currentTimesheet.projectDetails && (
                  <div style={{ 
                    backgroundColor: '#e9ecef', 
                    padding: '15px', 
                    borderRadius: '6px',
                    marginBottom: '15px'
                  }}>
                    <h5 style={{ margin: '0 0 10px 0', color: '#495057' }}>Project Details</h5>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                      <div><strong>Client:</strong> {selectedEmployee.currentTimesheet.projectDetails.client || 'Not specified'}</div>
                      <div><strong>Project:</strong> {selectedEmployee.currentTimesheet.projectDetails.project || 'Not specified'}</div>
                      <div><strong>CWS Code:</strong> {selectedEmployee.currentTimesheet.projectDetails.cwsCode || 'Not specified'}</div>
                    </div>
                  </div>
                )}
                
                {/* Daily Logs */}
                {selectedEmployee.currentTimesheet.days && selectedEmployee.currentTimesheet.days.length > 0 && (
                  <div style={{ marginBottom: '15px' }}>
                    <h5 style={{ color: '#495057', marginBottom: '10px' }}>Daily Time Logs</h5>
                    <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                      <table style={{ 
                        width: '100%', 
                        borderCollapse: 'collapse',
                        fontSize: '13px'
                      }}>
                        <thead>
                          <tr style={{ backgroundColor: '#e9ecef' }}>
                            <th style={{ padding: '8px', textAlign: 'left' }}>Date</th>
                            <th style={{ padding: '8px', textAlign: 'left' }}>Clock In</th>
                            <th style={{ padding: '8px', textAlign: 'left' }}>Clock Out</th>
                            <th style={{ padding: '8px', textAlign: 'left' }}>Working Log</th>
                            <th style={{ padding: '8px', textAlign: 'left' }}>Total Hours</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedEmployee.currentTimesheet.days.map((day, index) => (
                            <tr key={index} style={{ borderBottom: '1px solid #f8f9fa' }}>
                              <td style={{ padding: '8px' }}>{day.dateDisplay || formatDate(day.date)}</td>
                              <td style={{ padding: '8px' }}>{day.clockIn || '-'}</td>
                              <td style={{ padding: '8px' }}>{day.clockOut || '-'}</td>
                              <td style={{ padding: '8px' }}>{day.workingLog || '-'}</td>
                              <td style={{ padding: '8px', fontWeight: '500' }}>{day.totalLog || '0.00'} hrs</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                {/* Summary */}
                <div style={{ 
                  backgroundColor: '#f8f9fa', 
                  padding: '15px', 
                  borderRadius: '6px',
                  border: '1px solid #e9ecef'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div><strong>Total Hours:</strong> {getTotalHours(selectedEmployee.currentTimesheet).toFixed(1)}</div>
                    <div><strong>Status:</strong> 
                      <span style={{
                        marginLeft: '5px',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        backgroundColor: selectedEmployee.currentTimesheet.status === 'submitted' || selectedEmployee.currentTimesheet.status === 'approved' ? '#d4edda' :
                                      selectedEmployee.currentTimesheet.status === 'rejected' ? '#f8d7da' :
                                      '#fff3cd',
                        color: selectedEmployee.currentTimesheet.status === 'submitted' || selectedEmployee.currentTimesheet.status === 'approved' ? '#155724' :
                              selectedEmployee.currentTimesheet.status === 'rejected' ? '#721c24' :
                              '#856404'
                      }}>
                        {selectedEmployee.currentTimesheet.status || 'Not submitted'}
                      </span>
                    </div>
                    <div><strong>Submitted:</strong> {formatDate(selectedEmployee.currentTimesheet.submittedAt)}</div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Timesheet History */}
            {selectedEmployee.timesheets && selectedEmployee.timesheets.length > 0 && (
              <div style={{ marginBottom: '25px' }}>
                <h4 style={{ 
                  color: '#495057', 
                  marginBottom: '15px',
                  paddingBottom: '8px',
                  borderBottom: '2px solid #0077b6'
                }}>Timesheet History</h4>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  <table style={{ 
                    width: '100%', 
                    borderCollapse: 'collapse',
                    fontSize: '14px'
                  }}>
                    <thead>
                      <tr style={{ backgroundColor: '#e9ecef' }}>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Month</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Year</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Total Hours</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Submitted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedEmployee.timesheets.map((timesheet, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid #f8f9fa' }}>
                          <td style={{ padding: '10px' }}>{timesheet.month}</td>
                          <td style={{ padding: '10px' }}>{timesheet.year}</td>
                          <td style={{ padding: '10px', fontWeight: '500' }}>{getTotalHours(timesheet).toFixed(1)}</td>
                          <td style={{ padding: '10px' }}>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: '600',
                              backgroundColor: timesheet.status === 'submitted' || timesheet.status === 'approved' ? '#d4edda' :
                                            timesheet.status === 'rejected' ? '#f8d7da' :
                                            '#fff3cd',
                              color: timesheet.status === 'submitted' || timesheet.status === 'approved' ? '#155724' :
                                    timesheet.status === 'rejected' ? '#721c24' :
                                    '#856404'
                            }}>
                              {timesheet.status}
                            </span>
                          </td>
                          <td style={{ padding: '10px' }}>{formatDate(timesheet.submittedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            <div style={{ marginTop: '25px', textAlign: 'right' }}>
              <button
                onClick={() => {
                  setShowEmployeePopup(false);
                  setSelectedEmployee(null);
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: '30px', textAlign: 'center' }}>
        <button
          onClick={fetchAllData}
          disabled={isLoading}
          style={{
            padding: '10px 25px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          Refresh All Data
        </button>
      </div>
    </div>
  );
};

export default AdminDashboard;