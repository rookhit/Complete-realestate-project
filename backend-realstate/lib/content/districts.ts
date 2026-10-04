// The 77 districts of Nepal: a copy of the frontend's frontend-realstate/src/app/data/districts.ts
// (DISTRICTS_BY_PROVINCE). The exact spellings are the contract: district is an exact-match filter key.
// Keep in sync with the frontend when it changes.

export const DISTRICTS_BY_PROVINCE = {
  Koshi: [
    "Bhojpur", "Dhankuta", "Ilam", "Jhapa", "Khotang", "Morang", "Okhaldhunga",
    "Panchthar", "Sankhuwasabha", "Solukhumbu", "Sunsari", "Taplejung",
    "Terhathum", "Udayapur",
  ],
  Madhesh: [
    "Bara", "Dhanusha", "Mahottari", "Parsa", "Rautahat", "Saptari", "Sarlahi",
    "Siraha",
  ],
  Bagmati: [
    "Bhaktapur", "Chitwan", "Dhading", "Dolakha", "Kathmandu", "Kavrepalanchok",
    "Lalitpur", "Makwanpur", "Nuwakot", "Ramechhap", "Rasuwa", "Sindhuli",
    "Sindhupalchok",
  ],
  Gandaki: [
    "Baglung", "Gorkha", "Kaski", "Lamjung", "Manang", "Mustang", "Myagdi",
    "Nawalpur", "Parbat", "Syangja", "Tanahun",
  ],
  Lumbini: [
    "Arghakhanchi", "Banke", "Bardiya", "Dang", "Gulmi", "Kapilvastu",
    "Palpa", "Parasi", "Pyuthan", "Rolpa", "Rukum East", "Rupandehi",
  ],
  Karnali: [
    "Dailekh", "Dolpa", "Humla", "Jajarkot", "Jumla", "Kalikot", "Mugu",
    "Rukum West", "Salyan", "Surkhet",
  ],
  Sudurpashchim: [
    "Achham", "Baitadi", "Bajhang", "Bajura", "Dadeldhura", "Darchula", "Doti",
    "Kailali", "Kanchanpur",
  ],
};

export const DISTRICTS: readonly string[] = Object.values(DISTRICTS_BY_PROVINCE).flat();
const DISTRICT_SET = new Set(DISTRICTS);

export function isDistrict(value: string): boolean {
  return DISTRICT_SET.has(value);
}
