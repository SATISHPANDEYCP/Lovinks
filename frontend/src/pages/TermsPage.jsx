import { Link } from "react-router-dom";

const LAST_UPDATED = "April 6, 2026";

const TermsPage = () => {
  return (
    <div className="min-h-screen pt-20 pb-10 px-4">
      <div className="mx-auto max-w-3xl rounded-xl border border-base-300 bg-base-100 p-5 sm:p-7">
        <h1 className="text-2xl font-bold">Terms of Service</h1>
        <p className="mt-2 text-sm text-base-content/70">
          These Terms of Service govern your access to and use of Lovinks. By using the app, you
          agree to these terms.
        </p>
        <p className="mt-2 text-xs text-base-content/60">Last Updated: {LAST_UPDATED}</p>

        <div className="mt-6 space-y-4 text-sm leading-6 text-base-content/85">
          <section>
            <h2 className="font-semibold">1. Eligibility and Accounts</h2>
            <p>
              You are responsible for your account credentials and all activity conducted through
              your account.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">2. Acceptable Use</h2>
            <p>
              You must not misuse the platform, attempt unauthorized access, distribute malware, or
              share unlawful content.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">3. Content and Conduct</h2>
            <p>
              You retain rights to your content, but you are solely responsible for what you post,
              send, or store through the service.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">4. Service Availability</h2>
            <p>
              We aim for reliable availability, but interruptions, updates, and maintenance may
              occur without prior notice.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">5. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Lovinks is not liable for indirect,
              incidental, or consequential damages arising from service use.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">6. Contact</h2>
            <p>
              For legal or policy concerns, contact us at
              <a className="ml-1 link link-primary" href="mailto:scrptix@gmail.com">
                scrptix@gmail.com
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-8">
          <Link to="/login" className="btn btn-sm">
            Back
          </Link>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;
