# TimeCloud

- [Frontend](./Frontend/) contains the existing React/Vite/Tailwind dashboard and Supabase client integration.
- [Backend setup](./Backend/README.md) documents Supabase project configuration, migrations, privacy, and deployment.
- [Supabase migrations](./supabase/migrations/) contain the private workspace schema and RLS policies.

The application uses Supabase Auth and PostgreSQL directly. Configure the public frontend environment variables, apply the Supabase migrations, and deploy the `delete-account` Edge Function before enabling cloud usage. Follow the setup guide before treating the app as production-ready.
