import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './Dashboard.css';

const STORAGE_KEY = 'timesheet_data';
const API_BASE_URL = 'http://localhost:5000/api';

function toDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateForDisplay(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[date.getMonth()]} ${String(date.getDate()).padStart(2, '0')} ${date.getFullYear()}`;
}

function getCurrentMonthName() {
  const now = new Date();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
  return monthNames[now.getMonth()];
}

function calculateWorkingHours(clockIn, clockOut) {
  if (!clockIn || !clockOut) return '0.00';
  
  try {
    const parseTime = (timeStr) => {
      const timeStrLower = timeStr.toLowerCase().replace(' ', '');
      let timePart = timeStrLower;
      let period = '';
      
      if (timeStrLower.includes('am') || timeStrLower.includes('pm')) {
        period = timeStrLower.includes('am') ? 'am' : 'pm';
        timePart = timeStrLower.replace(/am|pm/g, '');
      }
      
      const [hoursStr, minutesStr] = timePart.split(':');
      let hours = parseInt(hoursStr);
      const minutes = parseInt(minutesStr || '0');
      
      if (period === 'pm' && hours !== 12) {
        hours += 12;
      } else if (period === 'am' && hours === 12) {
        hours = 0;
      }
      
      return hours + (minutes / 60);
    };
    
    const start = parseTime(clockIn);
    const end = parseTime(clockOut);
    
    let hoursWorked = end - start;
    if (hoursWorked < 0) hoursWorked += 24;
    
    return hoursWorked.toFixed(2);
  } catch {
    return '0.00';
  }
}

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [currentMonth] = useState(getCurrentMonthName());
  const [projectDetails, setProjectDetails] = useState({
    client: '',
    project: '',
    cwsCode: '',
  });
  const [leaveApplication, setLeaveApplication] = useState({
    leaveType: '',
    fromDate: '',
    toDate: '',
    reason: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const generateCurrentMonthDates = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
    const todayDate = today.getDate();
    
    const dates = [];
    for (let day = todayDate; day <= lastDay; day++) {
      const date = new Date(currentYear, currentMonth, day);
      const dateKey = toDateKey(date);
      
      dates.push({
        id: dateKey,
        date: formatDateForDisplay(dateKey),
        dateKey: dateKey,
        clockIn: '',
        clockOut: '',
        workingLog: '06:00 ↑',
        totalLog: '0.00',
        isSubmitted: false,
        isChecked: false,
      });
    }
    
    return dates;
  };

  const [timesheetData, setTimesheetData] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const currentDates = generateCurrentMonthDates();
        const merged = currentDates.map(date => {
          const savedData = parsed.find(d => d.id === date.id);
          return savedData ? { 
            ...date, 
            ...savedData,
            totalLog: savedData.clockIn && savedData.clockOut 
              ? calculateWorkingHours(savedData.clockIn, savedData.clockOut)
              : '0.00'
          } : date;
        });
        return merged;
      } catch {
        return generateCurrentMonthDates();
      }
    }
    return generateCurrentMonthDates();
  });

  useEffect(() => {
    const savedProject = localStorage.getItem('project_details');
    if (savedProject) {
      setProjectDetails(JSON.parse(savedProject));
    }
    
    const savedLeave = localStorage.getItem('leave_application');
    if (savedLeave) {
      setLeaveApplication(JSON.parse(savedLeave));
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/login';
      return;
    }
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setUser(payload);
      
      localStorage.setItem('userDetails', JSON.stringify(payload));
    } catch (err) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
  }, []);

  const updateProjectDetails = (field, value) => {
    const updated = { ...projectDetails, [field]: value };
    setProjectDetails(updated);
    localStorage.setItem('project_details', JSON.stringify(updated));
  };

  const updateLeaveApplication = (field, value) => {
    const updated = { ...leaveApplication, [field]: value };
    setLeaveApplication(updated);
    localStorage.setItem('leave_application', JSON.stringify(updated));
  };

  const calculateMonthlyTotal = () => {
    return timesheetData.reduce((total, day) => {
      if (day.isSubmitted && day.totalLog) {
        const hours = parseFloat(day.totalLog);
        return total + (isNaN(hours) ? 0 : hours);
      }
      return total;
    }, 0);
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timesheetData));
  }, [timesheetData]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('project_details');
    localStorage.removeItem('leave_application');
    localStorage.removeItem('userDetails');
    window.location.href = '/login';
  };

  const updateTime = (dateKey, field, value) => {
    setTimesheetData(prev => {
      const updated = prev.map(day => {
        if (day.dateKey === dateKey) {
          const updatedDay = { 
            ...day, 
            [field]: value,
            isChecked: true,
          };
          
          const clockIn = field === 'clockIn' ? value : day.clockIn;
          const clockOut = field === 'clockOut' ? value : day.clockOut;
          
          if (clockIn && clockOut) {
            updatedDay.totalLog = calculateWorkingHours(clockIn, clockOut);
          }
          
          return updatedDay;
        }
        return day;
      });
      return updated;
    });
  };

  const toggleCheckbox = (dateKey) => {
    setTimesheetData(prev => {
      const updated = prev.map(day => 
        day.dateKey === dateKey 
          ? { ...day, isChecked: !day.isChecked }
          : day
      );
      return updated;
    });
  };

  const submitTimesheet = async () => {
    const checkedDays = timesheetData.filter(day => day.isChecked);
    
    if (checkedDays.length === 0) {
      alert('Please select at least one day to submit');
      return;
    }

    const incompleteDays = checkedDays.filter(day => !day.clockIn || !day.clockOut);
    if (incompleteDays.length > 0) {
      alert('Please fill Clock In and Clock Out for all selected days');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const userDetails = JSON.parse(localStorage.getItem('userDetails') || '{}');
      
      const submitData = {
        employeeId: userDetails.empId || 'EMP001',
        employeeName: userDetails.name || 'Employee',
        employeeEmail: userDetails.email || 'employee@arohak.com',
        month: currentMonth,
        year: new Date().getFullYear(),
        days: checkedDays.map(day => ({
          date: day.dateKey,
          dateDisplay: day.date,
          clockIn: day.clockIn,
          clockOut: day.clockOut,
          workingLog: day.workingLog,
          totalLog: day.totalLog,
          submittedAt: new Date().toISOString()
        })),
        projectDetails: projectDetails,
        leaveApplications: leaveApplication.leaveType ? [{
          ...leaveApplication,
          appliedAt: new Date().toISOString(),
          status: 'pending'
        }] : [],
        monthlyTotal: calculateMonthlyTotal(),
      };

      console.log('Submitting timesheet:', submitData);

      const response = await fetch(`${API_BASE_URL}/timesheet/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(submitData)
      });

      const responseData = await response.json();
      
      if (response.ok && responseData.success) {
        setTimesheetData(prev => {
          const updated = prev.map(day => 
            day.isChecked 
              ? { ...day, isSubmitted: true, isChecked: false }
              : day
          );
          return updated;
        });
        
        alert('Timesheet submitted successfully to admin!');
        
        localStorage.removeItem(STORAGE_KEY);
        window.location.reload();
      } else {
        throw new Error(responseData.message || 'Submission failed');
      }
    } catch (error) {
      console.error('Error submitting timesheet:', error);
      alert(`Failed to submit timesheet: ${error.message}. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyLeave = () => {
    if (!leaveApplication.leaveType || !leaveApplication.fromDate || !leaveApplication.toDate) {
      alert('Please fill all required fields for leave application');
      return;
    }
    
    alert('Leave application saved! It will be submitted with your timesheet.');
  };

  const monthlyTotalHours = calculateMonthlyTotal();
  const todayKey = toDateKey();

  if (!user) return <div>Loading...</div>;

  return (
    <div>
      <nav className="navbar" role="navigation" aria-label="Main navigation">
        <div className="navbar-container">
          <div className="navbar-brand">
            <Link to="/" className="brand-logo">AROHAK TIMESHEET</Link>
          </div>
          <ul className="nav-links">
            <li className="nav-item">
              <button className="nav-link" onClick={() => setShowPopup(true)}>
                <span className="nav-icon"></span>
                <span className="nav-label">Profile</span>
              </button>
            </li>
            <li className="nav-item">
              <button className="nav-link" onClick={handleLogout}>
                <span className="nav-icon"></span>
                <span className="nav-label">Logout</span>
              </button>
            </li>
          </ul>
        </div>
      </nav>

      {showPopup && (
  <div className="profile-overlay">
    <div className="profile-card">
      <div className="profile-header">
        <img
          src={user.avatarUrl || "/default-avatar.png"}
          alt="User Avatar"
          className="avatar"
        />
        <div className="header-info">
          <h1>{user.name}</h1>
          <h3>{user.title || "Devloper"}</h3>
          <p>{user.location || "Hyderabad"}</p>
        </div>
      </div>

      <div className="profile-contact">
        <p><strong>DOB:</strong> {user.dob || "14.08.2001"} ({user.age || "25 y.o."})</p>
        <p><strong>Phone:</strong> {user.phone || "+1 (123) 123-3333"}</p>
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>Website:</strong> {user.website}</p>
        <p><strong>LinkedIn:</strong> {user.linkedin}</p>
        <div className="tags">
          {user.tags?.map(tag => <span key={tag}>{tag}</span>)}
        </div>
      </div>

      <div className="profile-section">
        <h2>Summary</h2>
        <p>{user.summary || "FUll stack developer with over 2  years of experience..."}</p>
      </div>

      <div className="profile-section">
        <h2>Experience</h2>
        <p><strong>{user.experienceTitle || "Developer"}</strong> at {user.experienceCompany || "Arohak"}</p>
        <p>{user.experienceDate || "April 2024 – Present"}</p>
        <div className="tags">
          {user.experienceTags?.map(tag => <span key={tag}>{tag}</span>)}
        </div>
      </div>

      <div className="profile-footer">
        <button onClick={() => setShowPopup(false)}>Close</button>
      </div>
    </div>
  </div>
)}

      <div className="main-layout">
        {/* Left panel with project and leave details */}
        <div className="left-panel">
          <div className="project-details-box">
            <h3>Project Details</h3>
            <div className="form-block">
              <label htmlFor='client_name'>Client:</label>
              <input 
                type="text" 
                id='client_name' 
                name='client_name' 
                value={projectDetails.client}
                onChange={(e) => updateProjectDetails('client', e.target.value)}
              />
            </div>
            <div className="form-block">
              <label htmlFor='project_name'>Project:</label>
              <select 
                id='project_name' 
                className='pro'
                value={projectDetails.project}
                onChange={(e) => updateProjectDetails('project', e.target.value)}
              >
                <option value="">-- Select Project --</option>
                <option value="crenma">Crenma</option>
                <option value="secure_transfer">Secure Transfer</option>
                <option value="cloud">Cloud</option>
                <option value="snow">Snow</option>
                <option value="web_methods">Web Methods</option>
                <option value="edi">EDI</option>
                <option value="kft">KFT</option>
                <option value="hrms">HRMS</option>
                <option value="mft">MFT</option>
              </select>
            </div>
            <div className="form-block">
              <label htmlFor='cws_code'>Cws Code:</label>
              <input 
                type="text" 
                id='cws_code' 
                name='cws_code' 
                value={projectDetails.cwsCode}
                onChange={(e) => updateProjectDetails('cwsCode', e.target.value)}
              />
            </div>
          </div>

          <div className="leave-application-box">
            <h3>Leave Application</h3>
            <div className="form-block">
              <label htmlFor='leave_type'>Leave Type:</label>
              <select 
                id='leave_type' 
                name='leave_type'
                value={leaveApplication.leaveType}
                onChange={(e) => updateLeaveApplication('leaveType', e.target.value)}
              >
                <option value="">-- Select Leave Type --</option>
                <option value="sick_leave">Sick Leave</option>
                <option value="casual_leave">Privilege Leave</option>
                <option value="earned_leave">Work From Home</option>
              </select>
            </div>
            <div className="form-block">
              <label htmlFor='from_date'>From Date:</label>
              <input 
                type="date" 
                id='from_date' 
                name='from_date' 
                value={leaveApplication.fromDate}
                onChange={(e) => updateLeaveApplication('fromDate', e.target.value)}
              />
            </div>
            <div className="form-block">
              <label htmlFor='to_date'>To Date:</label>
              <input 
                type="date" 
                id='to_date' 
                name='to_date' 
                value={leaveApplication.toDate}
                onChange={(e) => updateLeaveApplication('toDate', e.target.value)}
              />
            </div>
            <div className="form-block">
              <label htmlFor='reason'>Reason:</label>
              <textarea 
                id='reason' 
                name='reason' 
                rows="1"
                value={leaveApplication.reason}
                onChange={(e) => updateLeaveApplication('reason', e.target.value)}
              ></textarea>
            </div>
            <button className="apply-button" onClick={applyLeave}>
              Apply Leave
            </button>
          </div>
        </div>

        {/* Right panel with timesheet */}
        <div className="right-panel">
          <h2 className='timesheeet'>Timesheet - {currentMonth} {new Date().getFullYear()}</h2>

          <div className="summary-box" style={{ overflowX: 'auto' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: 20,
              padding: '10px 15px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Monthly Total</div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#2d3748' }}>
                    {monthlyTotalHours.toFixed(2)} hours
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Days Remaining</div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#48bb78' }}>
                    {timesheetData.filter(d => !d.isSubmitted).length}
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  className="apply-button" 
                  onClick={() => {
                    const today = timesheetData.find(d => d.dateKey === todayKey);
                    if (today) {
                      updateTime(todayKey, 'clockIn', new Date().toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: true 
                      }).toLowerCase());
                    }
                  }}
                  style={{ padding: '8px 16px' }}
                  disabled={isSubmitting}
                >
                  Clock In Now
                </button>
                <button 
                  className="submit-button" 
                  onClick={() => {
                    const today = timesheetData.find(d => d.dateKey === todayKey);
                    if (today) {
                      updateTime(todayKey, 'clockOut', new Date().toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: true 
                      }).toLowerCase());
                    }
                  }}
                  style={{ padding: '8px 16px', background: '#ed8936' }}
                  disabled={isSubmitting}
                >
                  Clock Out Now
                </button>
              </div>
            </div>
          
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              fontSize: '14px'
            }}>
              <thead>
                <tr style={{ 
                  textAlign: 'left', 
                  background: '#2d3748',
                  color: 'white'
                }}>
                  <th style={{ padding: '12px 10px', width: '5%' }}></th>
                  <th style={{ padding: '12px 10px', width: '20%' }}>DATE</th>
                  <th style={{ padding: '12px 10px', width: '18%' }}>CLOCK-IN</th>
                  <th style={{ padding: '12px 10px', width: '18%' }}>CLOCK-OUT</th>
                  <th style={{ padding: '12px 10px', width: '18%' }}>WORKING LOG</th>
                  <th style={{ padding: '12px 10px', width: '21%' }}>TOTAL LOG (hours)</th>
                </tr>
              </thead>
              <tbody>
                {timesheetData.map((row) => (
                  <tr 
                    key={row.id} 
                    style={{ 
                      background: row.dateKey === todayKey ? '#f0fff4' : 
                                 row.isSubmitted ? '#ebf8ff' : 
                                 row.isChecked ? '#fefcbf' : '#fff',
                      borderBottom: '1px solid #e2e8f0',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={row.isChecked}
                        onChange={() => toggleCheckbox(row.dateKey)}
                        disabled={row.isSubmitted}
                        style={{
                          width: '18px',
                          height: '18px',
                          cursor: row.isSubmitted ? 'not-allowed' : 'pointer',
                          accentColor: '#4299e1'
                        }}
                      />
                    </td>

                    <td style={{ padding: '12px 10px', fontWeight: '500' }}>
                      <div>{row.date}</div>
                      {row.dateKey === todayKey && (
                        <div style={{ fontSize: '11px', color: '#48bb78', marginTop: '2px' }}>
                          ● Today
                        </div>
                      )}
                      {row.isSubmitted && (
                        <div style={{ fontSize: '11px', color: '#4299e1', marginTop: '2px' }}>
                          ✓ Submitted
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '12px 10px' }}>
                      <input
                        type="text"
                        value={row.clockIn}
                        onChange={(e) => updateTime(row.dateKey, 'clockIn', e.target.value)}
                        placeholder="hh:mm am/pm"
                        disabled={row.isSubmitted}
                        style={{
                          padding: '8px 10px',
                          width: '100%',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e0',
                          background: row.isSubmitted ? '#f8f9fa' : '#fff',
                          fontSize: '13px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </td>

                    <td style={{ padding: '12px 10px' }}>
                      <input
                        type="text"
                        value={row.clockOut}
                        onChange={(e) => updateTime(row.dateKey, 'clockOut', e.target.value)}
                        placeholder="hh:mm am/pm"
                        disabled={row.isSubmitted}
                        style={{
                          padding: '8px 10px',
                          width: '100%',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e0',
                          background: row.isSubmitted ? '#f8f9fa' : '#fff',
                          fontSize: '13px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </td>

                    <td style={{ padding: '12px 10px' }}>
                      <input
                        type="text"
                        value={row.workingLog}
                        onChange={(e) => updateTime(row.dateKey, 'workingLog', e.target.value)}
                        disabled={row.isSubmitted}
                        style={{
                          padding: '8px 10px',
                          width: '100%',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e0',
                          background: row.isSubmitted ? '#f8f9fa' : '#fff',
                          fontSize: '13px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </td>

                    <td style={{ padding: '12px 10px' }}>
                      <div style={{ 
                        padding: '8px 12px', 
                        background: row.totalLog === '0.00' ? '#fed7d7' : '#c6f6d5',
                        borderRadius: '6px',
                        textAlign: 'center',
                        fontWeight: '600',
                        color: row.totalLog === '0.00' ? '#c53030' : '#276749',
                        fontSize: '14px'
                      }}>
                        {row.totalLog} hrs
                      </div>
                      {row.clockIn && row.clockOut && (
                        <div style={{ fontSize: '11px', color: '#666', marginTop: '4px', textAlign: 'center' }}>
                          {row.clockIn} - {row.clockOut}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ 
              marginTop: '15px', 
              padding: '15px', 
              background: '#f8f9fa', 
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Selected Days: {timesheetData.filter(d => d.isChecked).length}</div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                    Total Hours: {timesheetData.filter(d => d.isChecked).reduce((sum, day) => sum + parseFloat(day.totalLog || 0), 0).toFixed(2)}
                  </div>
                </div>
                <div>
                  <button 
                    className="submit-button" 
                    onClick={submitTimesheet}
                    style={{ padding: '10px 24px', fontSize: '15px' }}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Timesheet'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}