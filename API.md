# API Documentation

## Authentication Endpoints

### Register
- **POST** `/api/auth/register`
- **Body**:
  ```json
  {
    "name": "User Name",
    "email": "user@example.com",
    "password": "SecurePass123",
    "role": "user"
  }
  ```

### Login
- **POST** `/api/auth/login`
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePass123"
  }
  ```

### Logout
- **POST** `/api/auth/logout`

### Refresh Token
- **POST** `/api/auth/refresh`

---

## Transaction Endpoints

### Get All Transactions (Paginated)
- **GET** `/api/transactions?page=1&limit=20&sort=desc`
- **Auth**: Required
- **Query Parameters**:
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 20, max: 100)
  - `sort`: Sort order (asc/desc, default: desc)

### Create Transaction
- **POST** `/api/transactions`
- **Auth**: Required
- **Body**:
  ```json
  {
    "date": "2024-02-19T00:00:00Z",
    "description": "Transaction description",
    "amount": 100.00,
    "type": "הוצאה",
    "category": "food",
    "account": "checking"
  }
  ```

### Get Transaction by ID
- **GET** `/api/transactions/:id`
- **Auth**: Required

### Update Transaction
- **PUT** `/api/transactions/:id`
- **Auth**: Required

### Delete Transaction
- **DELETE** `/api/transactions/:id`
- **Auth**: Required

---

## Error Responses

### 400 Bad Request
```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Valid email is required"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "message": "טוקן לא חוקי / פג תוקף"
}
```

### 403 Forbidden
```json
{
  "message": "Invalid or missing CSRF token."
}
```

### 404 Not Found
```json
{
  "message": "API endpoint not found"
}
```

### 500 Internal Server Error
```json
{
  "status": "error",
  "message": "Something went very wrong!"
}
```

---

## Response Format

All successful responses follow this format:

```json
{
  "status": "success",
  "message": "Operation successful",
  "data": {}
}
```

Paginated responses:

```json
{
  "data": [],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

---

## Authentication

- All protected endpoints require a valid JWT token in cookies (`jwt`)
- Token expires in 15 minutes
- Use refresh token to get new token (expires in 7 days)
- CSRF token is required for state-changing requests (POST, PUT, DELETE)
- Get CSRF token from `/api/csrf-token`

---

## Rate Limiting

- General endpoints: 100 requests per 15 minutes
- Auth endpoints: 5 requests per 15 minutes
- Additional limits may apply to specific endpoints

---

## Environment Variables

See `.env.example` in the server directory for required environment variables.
