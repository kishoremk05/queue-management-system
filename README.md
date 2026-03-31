# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Dynamic billing integration

This project now includes a dynamic billing flow with:

- Editable plan prices from `billing_plans`
- Paystack-only payment processing
- In-house commission tracking (`gross_amount`, `commission_amount`, `net_amount`)

Default plans:

- `starter` (NGN 29,000 / month)
- `professional` (NGN 79,000 / month)
- `enterprise` (NGN 199,000 / month)

### What is included

- Plan selection on company signup
- Secure transaction initialization via Supabase Edge Function
- Redirect to Paystack checkout
- Callback verification and payment status updates
- Super admin approval restricted to paid requests
- Subscription row creation on approval

### Required Supabase secrets

Set these secrets in your Supabase project before deploying functions:

```sh
supabase secrets set PAYSTACK_SECRET_KEY=sk_test_xxx
supabase secrets set PAYMENT_CALLBACK_URL=https://your-app-domain/payment/callback
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically in Edge Functions.

### Deploy database and functions

```sh
supabase db push
supabase functions deploy payment-initialize
supabase functions deploy payment-verify
```

### Change prices and commission

Update pricing without redeploying frontend:

- Edit rows in `public.billing_plans`
- Edit rows in `public.billing_plan_prices` for each currency
- Set commission in `public.platform_payment_settings` (row `id = 1`)

You can also manage plan prices directly from the Super Admin page in-app. Website and signup read updated prices live.

### Multi-currency support

- Signup and landing pricing now support multiple currencies.
- Selected checkout currency is stored in `company_requests.selected_currency`.
- Payment initialization resolves the amount from `billing_plan_prices` using the selected plan + currency.

### Frontend environment variables

Make sure these are configured in your frontend environment:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
