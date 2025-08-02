export interface UserData {
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

export interface Rriot {
  u: string;
  s: string;
  h: string;
  k: string;
  r: {
    r: string;
    a: string;
    m: string;
    l: string;
  };
}
