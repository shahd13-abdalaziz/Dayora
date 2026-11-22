// Keeps the login (token + user) in the browser so the next page already knows who you are.
const Store = {
  TOKEN: 'dayora_token',
  USER: 'dayora_user',

  getToken() {
    return localStorage.getItem(this.TOKEN);
  },

  getUser() {
    try {
      return JSON.parse(localStorage.getItem(this.USER));
    } catch {
      return null;
    }
  },

  setSession(token, user) {
    localStorage.setItem(this.TOKEN, token);
    localStorage.setItem(this.USER, JSON.stringify(user));
  },

  setUser(user) {
    localStorage.setItem(this.USER, JSON.stringify(user));
  },

  clear() {
    localStorage.removeItem(this.TOKEN);
    localStorage.removeItem(this.USER);
  },
};
