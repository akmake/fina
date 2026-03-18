/**
 * Returns a Mongoose filter for the "user" field
 * that expands to all family members when the user belongs to a group.
 *
 * Usage in controllers:
 *   const filter = { ...scopeFilter(req), date: { $gte: ... } };
 */
export const scopeFilter = (req) => {
  const users = req.scopeUsers;
  if (users && users.length > 1) {
    return { user: { $in: users } };
  }
  return { user: req.user._id };
};
