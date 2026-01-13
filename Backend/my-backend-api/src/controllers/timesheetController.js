// controllers/timesheetController.js
import Timesheet from '../models/Timesheet.js';
import Employee from '../models/Employee.js';

// Helper function to parse time string
function parseTimeString(timeStr) {
  if (!timeStr) return null;
  
  try {
    // Format: "09:00 am" or "09:00" or "9:00 AM"
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
    
    // Convert to 24-hour format
    if (period === 'pm' && hours !== 12) {
      hours += 12;
    } else if (period === 'am' && hours === 12) {
      hours = 0;
    }
    
    // Create date object with today's date but specific time
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  } catch (err) {
    console.error('Error parsing time:', timeStr, err);
    return null;
  }
}

// Submit timesheet
export const submitTimesheet = async (req, res) => {
  try {
    const { 
      employeeId, 
      employeeName, 
      employeeEmail, 
      month, 
      year, 
      days, 
      projectDetails, 
      leaveApplications,
      monthlyTotal 
    } = req.body;

    console.log('Submitting timesheet for:', employeeId);

    // Calculate working hours for each day
    const updatedDays = days.map(day => {
      const newDay = { ...day };
      
      if (day.clockIn && day.clockOut) {
        const clockInTime = parseTimeString(day.clockIn);
        const clockOutTime = parseTimeString(day.clockOut);
        
        if (clockInTime && clockOutTime) {
          // Calculate difference in hours
          let diffMs = clockOutTime - clockInTime;
          
          // Handle overnight (if clock out is earlier than clock in)
          if (diffMs < 0) {
            diffMs += (24 * 60 * 60 * 1000); // Add 24 hours
          }
          
          const totalHours = diffMs / (1000 * 60 * 60);
          
          // Format to 2 decimal places
          newDay.totalLog = totalHours.toFixed(2);
        }
      }
      return newDay;
    });

    // Create or update timesheet
    const existingTimesheet = await Timesheet.findOne({
      employeeId,
      month,
      year,
    });

    if (existingTimesheet) {
      // Update existing timesheet
      existingTimesheet.days = updatedDays;
      existingTimesheet.projectDetails = projectDetails || {};
      existingTimesheet.leaveApplications = leaveApplications || [];
      existingTimesheet.monthlyTotal = monthlyTotal || 0;
      existingTimesheet.status = 'submitted';
      existingTimesheet.submittedAt = new Date();
      
      await existingTimesheet.save();
      console.log('Updated existing timesheet');
    } else {
      // Create new timesheet
      await Timesheet.create({
        employeeId,
        employeeName,
        employeeEmail,
        month,
        year,
        days: updatedDays,
        projectDetails: projectDetails || {},
        leaveApplications: leaveApplications || [],
        monthlyTotal: monthlyTotal || 0,
        status: 'submitted',
      });
      console.log('Created new timesheet');
    }

    res.json({ 
      success: true,
      message: 'Timesheet submitted successfully' 
    });
  } catch (err) {
    console.error('Submit timesheet error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

// Get all employee timesheets for admin
export const getEmployeeTimesheets = async (req, res) => {
  try {
    const { month, year, search } = req.query;
    
    let query = { status: 'submitted' };
    
    if (month && year) {
      query.month = month;
      query.year = parseInt(year);
    }
    
    // Search by employeeId or employeeName
    if (search) {
      query.$or = [
        { employeeId: { $regex: search, $options: 'i' } },
        { employeeName: { $regex: search, $options: 'i' } },
        { employeeEmail: { $regex: search, $options: 'i' } },
      ];
    }
    
    const timesheets = await Timesheet.find(query)
      .sort({ submittedAt: -1 })
      .lean();
    
    res.json(timesheets);
  } catch (err) {
    console.error('Get timesheets error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get employee details with timesheet
export const getEmployeeDetails = async (req, res) => {
  try {
    const { empId } = req.params;
    
    // Get employee details from Employee model
    const employee = await Employee.findOne({ empId });
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    
    // Get timesheets from Timesheet model
    const timesheets = await Timesheet.find({ employeeId: empId })
      .sort({ year: -1, month: -1 })
      .limit(12); // Last 12 months
    
    // Get current month timesheet
    const currentDate = new Date();
    const currentMonth = currentDate.toLocaleString('default', { month: 'long' });
    const currentYear = currentDate.getFullYear();
    
    const currentTimesheet = await Timesheet.findOne({
      employeeId: empId,
      month: currentMonth,
      year: currentYear,
    });
    
    res.json({
      employee,
      timesheets,
      currentTimesheet,
    });
  } catch (err) {
    console.error('Get employee details error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all employees - FIXED EXPORT
export const getAllEmployees = async (req, res) => {
  try {
    const { search } = req.query;
    
    let query = { isActive: true };
    
    if (search) {
      query.$or = [
        { empId: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    
    const employees = await Employee.find(query)
      .sort({ empId: 1 });
    
    res.json(employees);
  } catch (err) {
    console.error('Get employees error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// You might also want this function to get all users from User model
export const getAllUsers = async (req, res) => {
  try {
    const User = (await import('../models/User.js')).default;
    
    const { search } = req.query;
    
    let query = { role: 'user' }; // Only get regular users
    
    if (search) {
      query.$or = [
        { empId: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    
    const users = await User.find(query)
      .select('-password') // Exclude password
      .sort({ createdAt: -1 });
    
    res.json(users);
  } catch (err) {
    console.error('Get all users error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};