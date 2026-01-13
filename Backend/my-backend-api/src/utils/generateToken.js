import jwt from 'jsonwebtoken';

export const generateToken = (id, role, empId, email, name) => {
  return jwt.sign(
    { id, role, empId, email, name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );
};