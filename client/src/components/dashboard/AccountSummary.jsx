import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ICONS = {
  checking: '🏦',
  cash: '💵',
  deposits: '📈',
  stocks: '📊',
};

const NAMES = {
  checking: 'עו"ש',
  cash: 'מזומן',
  deposits: 'פקדונות',
  stocks: 'השקעות',
}

export const AccountSummary = ({ accounts = [] }) => (
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
    {accounts.map((account) => (
      <Card key={account.name}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{NAMES[account.name] || account.name}</CardTitle>
          <span className="text-2xl">{ICONS[account.name] || '💰'}</span>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">₪{account.balance.toLocaleString('he-IL', { minimumFractionDigits: 2 })}</div>
        </CardContent>
      </Card>
    ))}
  </div>
);