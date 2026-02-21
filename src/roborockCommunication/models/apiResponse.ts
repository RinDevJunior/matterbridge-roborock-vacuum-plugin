export interface ApiResponse<T> {
  result?: T;
  success?: boolean;
  status: string;
}
