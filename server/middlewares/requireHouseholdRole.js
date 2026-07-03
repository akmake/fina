/**
 * Guard a route by household role. Must run AFTER resolveHousehold (so
 * req.member is populated).
 *
 *   router.post('/invite', requireHouseholdRole('owner'), invite)
 */
export const requireHouseholdRole = (...roles) => (req, res, next) => {
  const role = req.member?.role;
  if (!role) {
    return res.status(403).json({ message: 'אין הקשר משק בית' });
  }
  if (!roles.includes(role)) {
    return res.status(403).json({ message: 'אין לך הרשאה לפעולה זו במשק הבית' });
  }
  next();
};

export default requireHouseholdRole;
