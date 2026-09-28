import { AccountType } from '../../api/models/account-type';

/** Tabler icon names (https://tabler.io/icons) available for accounts. Stored as-is in `accounts.icon`. */
export enum AccountIcon {
  CreditCard   = 'credit-card',
  BuildingBank = 'building-bank',
  Wallet       = 'wallet',
  PigMoney     = 'pig-money',
  Cash         = 'cash',
  Coins        = 'coins',
  Briefcase    = 'briefcase',
  ShoppingCart = 'shopping-cart',
  Kitchen      = 'tools-kitchen-2',
  Home         = 'home',
  Bolt         = 'bolt',
  Car          = 'car',
  GasStation   = 'gas-station',
  Confetti     = 'confetti',
  Refresh      = 'refresh',
  DeviceMobile = 'device-mobile',
  Heartbeat    = 'heartbeat',
  School       = 'school',
  Plane        = 'plane',
  Shirt        = 'shirt',
  Gift         = 'gift',
  User         = 'user',
  Receipt      = 'receipt',
  Category     = 'category',
}

/** Picker order. */
export const ACCOUNT_ICONS: readonly AccountIcon[] = Object.values(AccountIcon);

export const DEFAULT_ICON_BY_ACCOUNT_TYPE: Record<AccountType, AccountIcon> = {
  ASSET:     AccountIcon.BuildingBank,
  LIABILITY: AccountIcon.CreditCard,
  EQUITY:    AccountIcon.Coins,
  INCOME:    AccountIcon.Briefcase,
  EXPENSE:   AccountIcon.Category,
};

export const FALLBACK_ACCOUNT_ICON = AccountIcon.Category;
