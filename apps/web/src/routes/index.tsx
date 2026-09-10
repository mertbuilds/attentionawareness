import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@keepyourattention/ui';
import { colors, font, spacing } from '@keepyourattention/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { createFileRoute, Link } from '@tanstack/react-router';
import { layout } from '../lib/layout.ts';
import { api } from '../lib/orpc.ts';
import { m } from '../paraglide/messages.js';

type Plan = Awaited<ReturnType<typeof api.billing.plans>>[number];

export const Route = createFileRoute('/')({
  component: Landing,
  loader: () => api.billing.plans(),
});

const styles = create({
  hero: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
    textAlign: 'center',
  },
  main: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    color: colors.fg,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: font.family,
    gap: spacing.s6,
    justifyContent: 'center',
    minHeight: '100vh',
    paddingInline: spacing.s4,
  },
  price: {
    fontSize: font.sizeLg,
    // Prices update dynamically per plan — tabular digits prevent layout shift.
    fontVariantNumeric: 'tabular-nums',
    fontWeight: font.weightBold,
  },
  row: {
    display: 'flex',
    gap: spacing.s2,
  },
  title: {
    fontSize: 40,
    fontWeight: font.weightBold,
    letterSpacing: '-0.02em',
    margin: 0,
    textWrap: 'balance',
  },
});

function Landing() {
  const plans = Route.useLoaderData();
  return (
    <main {...props(styles.main)}>
      <div {...props(styles.hero)}>
        <h1 {...props(styles.title)}>{m.app_name()}</h1>
        <p {...props(layout.muted)}>{m.app_tagline()}</p>
      </div>
      {plans.map((plan: Plan) => (
        <Card key={plan.priceId} size="sm" style={{ width: 280 }}>
          <CardHeader>
            <CardTitle>{m.billing_plan_pro()}</CardTitle>
            <CardDescription>{m.pricing_pro_description()}</CardDescription>
          </CardHeader>
          <CardContent>
            <span {...props(styles.price)}>
              {m.pricing_per_month({
                amount: `$${(plan.unitAmount / 100).toFixed(0)}`,
              })}
            </span>
          </CardContent>
          <CardFooter>
            <Badge variant="outline">{m.pricing_billed_monthly()}</Badge>
          </CardFooter>
        </Card>
      ))}
      <div {...props(styles.row)}>
        <Button render={<Link to="/signup" />}>{m.auth_signup_title()}</Button>
        <Button render={<Link to="/login" />} variant="outline">
          {m.auth_login_title()}
        </Button>
      </div>
    </main>
  );
}
