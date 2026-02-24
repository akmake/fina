/**
 * Pagination helper for MongoDB queries
 * @param {Array} data - Array of documents
 * @param {Number} page - Current page (1-indexed)
 * @param {Number} limit - Items per page
 * @returns {Object} Paginated response object
 */
export const paginate = (data, page = 1, limit = 20) => {
  const total = data.length;
  const totalPages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedData = data.slice(startIndex, endIndex);

  return {
    data: paginatedData,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
};

/**
 * Build MongoDB pagination options
 * @param {Number} page - Current page (1-indexed)
 * @param {Number} limit - Items per page
 * @returns {Object} Skip and limit values for MongoDB
 */
export const getPaginationOptions = (page = 1, limit = 20) => {
  const cleanPage = Math.max(1, parseInt(page) || 1);
  const cleanLimit = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const skip = (cleanPage - 1) * cleanLimit;

  return {
    skip,
    limit: cleanLimit,
    page: cleanPage,
  };
};

/**
 * Format paginated MongoDB result
 * @param {Array} documents - Array of documents from query
 * @param {Number} total - Total count from countDocuments
 * @param {Number} page - Current page
 * @param {Number} limit - Items per page
 * @returns {Object} Formatted paginated response
 */
export const formatPaginatedResponse = (documents, total, page = 1, limit = 20) => {
  const cleanPage = Math.max(1, parseInt(page) || 1);
  const cleanLimit = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const totalPages = Math.ceil(total / cleanLimit);

  return {
    data: documents,
    pagination: {
      total,
      page: cleanPage,
      limit: cleanLimit,
      totalPages,
      hasNextPage: cleanPage < totalPages,
      hasPreviousPage: cleanPage > 1,
    },
  };
};
