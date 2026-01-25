export interface UserData {
  username: string;
  uid: string | number;
  tokentype: string;
  token: string;
  rruid: string;
  region: string;
  countrycode: string;
  country: string;
  nickname: string;
  rriot: Rriot;
}

interface r {
  r: string;
  a: string;
  m: string;
  l: string;
}

export interface Rriot {
  u: string;
  s: string;
  h: string;
  k: string;
  r: r;
}
