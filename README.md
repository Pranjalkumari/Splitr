# Splitr - Full Stack AI Splitwise Clone

## Project Description
A full-stack intelligent expense splitting application designed to simplify shared finances. Splitr allows friends and roommates to track expenses, split bills effortlessly, and settle up quickly. It leverages the power of Convex for real-time data, Clerk for secure authentication, and Inngest for background workflows like spending insights.

## Features

### 👤 User Features
- **Secure Authentication**: Seamless sign-up and login powered by Clerk.
- **Group Management**: Create and manage groups for trips, roommates, or events.
- **Advanced Expense Splitting**: Support for multiple split types:
  - **Equal**: Split equally among members.
  - **Percentage**: Split based on defined percentages.
  - **Exact**: Assign specific amounts to each person.
- **Real-Time Dashboard**: View balances, recent activities, and group details instantly.
- **Settlements**: Record payments and settle debts with a single click.
- **Spending Insights**: Automated insights into spending habits (powered by Inngest).

### 🛠 Technical Features
- **Real-Time Database**: Instant updates across all clients using Convex.
- **Responsive UI**: Built with Tailwind CSS and Shadcn UI for a clean, modern look.
- **Type Safety**: End-to-end type safety with TypeScript and Convex schemas.
- **Background Jobs**: Asynchronous processing for reliable data handling.

## 📊 Tech Stack

### Client (Frontend)
- **Next.js 14**: App Router for modern routing and layouts.
- **React**: Component-based UI architecture.
- **Tailwind CSS**: Utility-first styling.
- **Shadcn UI**: Reusable, accessible UI components.
- **Lucide React**: Beautiful icons.

### Server (Backend)
- **Convex**: Backend-as-a-Service (BaaS) for database and real-time functions.
- **Clerk**: Complete user management and authentication.
- **Inngest**: Event-driven queues for background jobs and workflows.

## 🔄 How It Works

1.  **Sign Up**: Users authenticate securely via Clerk.
2.  **Create a Group**: Users set up a group and invite friends.
3.  **Add Expenses**:
    - User details the expense (amount, description, category).
    - Selects the split method (Equal, Percentage, Exact).
    - Convex stores the transaction and updates balances in real-time.
4.  **Settle Up**:
    - Users can view who owes whom.
    - Recording a settlement updates the ledger instantly.

## 🎨 UI Design Decisions
- **Modern & Minimal**: Uses a clean white and green color palette to evoke financial positivity.
- **Mobile First**: Fully responsive layout that works perfectly on phones and desktops.
- **Feedback Driven**: Uses `Sonner` for toast notifications to give users immediate feedback on actions (e.g., "Expense Added").
- **Card-Based Layout**: Dashboard and lists are organized into cards for better readability.

## ⚙️ Installation & Setup

**1. Clone the repository**

git clone [https://github.com/pranjalkumari/splitr.git](https://github.com/pranjalkumari/splitr.git)
cd splitr

**2. Install dependencies**

npm install

**3. Setup Environment Variables**
 Create a .env.local file in the root directory and add the following keys. You can find these in your Clerk and Convex dashboards.

- Deployment used by `npx convex dev`.
  CONVEX_DEPLOYMENT=dev:descriptive-possum-368 

- Convex Public URL
  NEXT_PUBLIC_CONVEX_URL=https://descriptive-possum-368.convex.cloud

- Clerk Authentication Keys
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_ZmFpdGhmdWwtcmFiYml0LTgyLmNsZXJrLmFjY291bnRzLmRldiQ
  CLERK_SECRET_KEY=sk_test_gbJAyH2oNavtM4JPPqReJTwNtwj8CVTKWbcjGuWVzm

**4. Start the Convex Dev Server** 

 -Bash
  npx convex dev
 
**5. Run the Application Start the Next.js development server.**

 -Bash
  npm run dev
