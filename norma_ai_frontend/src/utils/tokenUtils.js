export const saveToken = (token) => {
  localStorage.setItem('token', token);
};

export const getToken = () => {
  return localStorage.getItem('token');
};

export const removeToken = () => {
  localStorage.removeItem('token');
};

export const isTokenExpired = (token) => {
  if (!token) return true;
  
  try {
    // JWT tokens are made of three parts: header, payload, and signature
    // We need to decode the payload (middle part)
    const payload = token.split('.')[1];
    const decodedPayload = JSON.parse(atob(payload));
    
    // Check if the token has an expiration time
    if (!decodedPayload.exp) return false;
    
    // Compare the expiration time with the current time
    const expirationDate = new Date(decodedPayload.exp * 1000);
    const currentDate = new Date();
    
    return currentDate > expirationDate;
  } catch (error) {
    console.error('Error checking token expiration:', error);
    return true; // Assume the token is expired if there's an error
  }
};
