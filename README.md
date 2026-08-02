# PaddleHubs

An open-source pickleball tournament management platform — teams, brackets,
schedules, match history, player rankings, court bookings, and a live
player auction — built by **Sai Sidharth**.

Live at [paddlehubs.com](https://paddlehubs.com).

## Stack

- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS
- **Auth:** AWS Cognito (Hosted UI)
- **Backend:** AWS API Gateway + Lambda + DynamoDB
- **Hosting:** AWS S3 + CloudFront

## Run locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local` and fill in your Cognito/API Gateway
   values (see that file for what each one is).
3. Run the app:
   `npm run dev`

## Deploy

```bash
npm run build
aws s3 sync dist/ s3://<your-bucket> --delete
aws cloudfront create-invalidation --distribution-id <your-distribution-id> --paths "/*"
```
