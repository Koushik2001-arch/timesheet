import mongoose from 'mongoose';

const timesheetSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    required: true,
  },
  employeeName: {
    type: String,
    required: true,
  },
  employeeEmail: {
    type: String,
    required: true,
  },
  month: {
    type: String,
    required: true,
  },
  year: {
    type: Number,
    required: true,
  },
  days: [{
    date: {
      type: Date,
      required: true,
    },
    dateDisplay: String,
    clockIn: String,
    clockOut: String,
    workingLog: String,
    totalLog: String,
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  projectDetails: {
    client: String,
    project: String,
    cwsCode: String,
  },
  leaveApplications: [{
    leaveType: String,
    fromDate: Date,
    toDate: Date,
    reason: String,
    appliedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
  }],
  monthlyTotal: {
    type: Number,
    default: 0,
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'approved', 'rejected'],
    default: 'draft',
  },
});

const Timesheet = mongoose.model('Timesheet', timesheetSchema);
export default Timesheet;