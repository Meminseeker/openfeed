// Sign-in, sign-up and session notices (server/auth.ts).
export const authNotices = {
  "auth.invalidUsername":
    "Use a username of 3–40 letters, numbers, dots, dashes or underscores.",
  "auth.invalidPassword": "Use a password of 12–128 characters.",
  "auth.noAccount":
    "There is no account with the username “{username}”. Check the spelling, or create an account first.",
  "auth.wrongPassword": "Incorrect password for “{username}”.",
  "auth.usernameTaken": "That username is already in use.",
  "auth.claimRequired":
    "The owner must claim the existing workspace using OPENFEED_SETUP_TOKEN before signup opens.",
  "auth.tooManyAttempts": "Too many attempts. Try again in 15 minutes.",
  "auth.accountChangedLogout":
    "Your account changed. Reload before logging out.",
  "auth.accountChangedSave": "Your account changed. Reload before saving.",
  "auth.loginRequired": "Please log in.",
} as const;
