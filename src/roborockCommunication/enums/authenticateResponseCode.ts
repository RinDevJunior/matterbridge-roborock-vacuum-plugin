export enum AuthenticateResponseCode {
	Success = 200,
	AccountNotFound = 2008,
	InvalidCode = 2018,
	InvalidUserAgreement = 3006,
	NoUserAgreement = 3009,
	RateLimited = 9002,
}
