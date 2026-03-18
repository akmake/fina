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
  // Always use the ObjectId from scopeUsers (already cast), not the raw JWT string
  return { user: users?.[0] ?? req.user._id };
};
