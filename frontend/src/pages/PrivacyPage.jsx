import { Link } from "react-router-dom";
import { X } from "lucide-react";

const LAST_UPDATED = "April 6, 2026";

const PrivacyPage = () => {
  return (
    <div className="min-h-screen pt-20 pb-10 px-4">
      <div className="mx-auto max-w-3xl rounded-xl border border-base-300 bg-base-100 p-5 sm:p-7">
        <div className="flex justify-end">
          <Link to="/login" className="btn btn-circle btn-sm" aria-label="Close privacy page">
            <X className="size-4" />
          </Link>
        </div>
        <h1 className="text-2xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-base-content/70">
          Your privacy matters to us. This Privacy Policy explains what information we collect, how
          we use it, and your rights when using Lovinks.
        </p>
        <p className="mt-2 text-xs text-base-content/60">Last Updated: {LAST_UPDATED}</p>

        <div className="mt-6 space-y-4 text-sm leading-6 text-base-content/85">
          <section>
            <h2 className="font-semibold">1. Information We Collect</h2>
            <p>
              We may collect account details such as your name, email address, profile photo, and
              service-related metadata required to operate core chat functionality.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">2. How We Use Information</h2>
            <p>
              We use your data to provide authentication, message delivery, account safety,
              reliability improvements, and customer support.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">3. Data Sharing</h2>
            <p>
              We do not sell personal data. We may share limited information with trusted service
              providers strictly for hosting, delivery, and security operations.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">4. Security and Retention</h2>
            <p>
              We apply reasonable technical and organizational safeguards to protect your
              information and retain data only as long as necessary for service and legal
              obligations.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">5. Your Rights</h2>
            <p>
              You may request access, correction, or deletion of your personal data by contacting
              us through the support email listed below.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">6. Contact</h2>
            <p>
              For privacy requests, contact us at
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

export default PrivacyPage;
