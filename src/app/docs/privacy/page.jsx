"use client";

import { motion } from "framer-motion";

function Section({ number, title, children, delay = 0 }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="mb-12"
    >
      <h2 className="text-lg font-semibold text-zinc-900 mb-4 flex items-baseline gap-3">
        <span className="text-zinc-500 font-normal">{number}.</span>
        {title}
      </h2>
      <div className="text-zinc-600 leading-relaxed">
        {children}
      </div>
    </motion.section>
  );
}

function ListItem({ children }) {
  return (
    <li className="flex items-start gap-3 text-zinc-600">
      <span className="inline-block w-1 h-1 rounded-full bg-zinc-300 mt-2.5 flex-shrink-0" />
      <span>{children}</span>
    </li>
  );
}

export default function PrivacyPolicy() {
  return (
    <article className="max-w-2xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12"
      >
        <h1 className="text-3xl font-bold text-zinc-900 mb-2">Privacy Policy</h1>
        <p className="text-zinc-400 text-sm">
          Last updated December 24, 2024
        </p>
      </motion.div>

      {/* Introduction */}
      <motion.p
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="text-zinc-600 leading-relaxed mb-12"
      >
        At Zentari, your privacy is our top priority. This policy explains how we collect, use,
        and protect your personal information when you use our financial management platform.
      </motion.p>

      {/* Sections */}
      <Section number="1" title="Information We Collect" delay={0.1}>
        <p className="mb-4">
          When you use Zentari, we collect information you provide directly, including:
        </p>
        <ul className="space-y-2">
          <ListItem>Account information (name, email address)</ListItem>
          <ListItem>Financial account connection data provided via our secure third-party provider (Plaid)</ListItem>
          <ListItem>Transaction data from your linked financial accounts</ListItem>
          <ListItem>Usage data and preferences</ListItem>
        </ul>
      </Section>

      <Section number="2" title="How We Use Your Information" delay={0.12}>
        <p className="mb-4">
          We use the information we collect to:
        </p>
        <ul className="space-y-2">
          <ListItem>Provide and maintain our services</ListItem>
          <ListItem>Display your financial information and analytics</ListItem>
          <ListItem>Send you updates and notifications</ListItem>
          <ListItem>Improve and personalize your experience</ListItem>
          <ListItem>Protect against fraud and unauthorized access</ListItem>
        </ul>
      </Section>

      <Section number="3" title="Data Sharing" delay={0.14}>
        <p>
          We do not sell, rent, or trade your personal information. We only share data with service
          providers strictly necessary to operate the platform, under contractual obligations to
          protect user data, and only for the purposes described in this policy. We may disclose
          information if required to do so by law, regulation, or valid legal process.
        </p>
      </Section>

      <Section number="4" title="Data Security" delay={0.16}>
        <p>
          We implement industry-standard security measures to protect your data. All data is encrypted
          in transit and at rest. We do not store banking login credentials. Financial connections are
          handled exclusively through Plaid, which is certified and compliant with industry standards.
        </p>
      </Section>

      <Section number="5" title="Data Retention" delay={0.18}>
        <p>
          We retain your personal data only for as long as necessary to provide our services and comply
          with legal obligations. You may request deletion of your account and associated data at any time.
        </p>
      </Section>

      <Section number="6" title="Third-Party Services" delay={0.2}>
        <p>
          We use third-party services to provide our functionality, including Plaid for financial
          account connections and Supabase for data storage. These services have their own privacy
          policies governing their use of your data.
        </p>
      </Section>

      <Section number="7" title="Legal Basis for Processing" delay={0.22}>
        <p>
          We process your data based on your consent, contractual necessity to provide our services,
          and compliance with legal obligations.
        </p>
      </Section>

      <Section number="8" title="Your Rights" delay={0.24}>
        <p className="mb-4">
          You have the right to:
        </p>
        <ul className="space-y-2">
          <ListItem>Access your personal data</ListItem>
          <ListItem>Request correction of inaccurate data</ListItem>
          <ListItem>Request deletion of your data</ListItem>
          <ListItem>Disconnect your financial accounts at any time</ListItem>
          <ListItem>Export your data</ListItem>
        </ul>
      </Section>

      <Section number="9" title="Financial Services Disclaimer" delay={0.26}>
        <p>
          Zentari is not a bank, broker-dealer, investment advisor, or fiduciary. Investment accounts
          and brokerage services are provided by our third-party partners. Zentari does not provide
          investment advice.
        </p>
      </Section>

      <Section number="10" title="Children's Privacy" delay={0.28}>
        <p>
          Zentari is not intended for individuals under the age of 18, and we do not knowingly collect
          personal data from minors.
        </p>
      </Section>

      <Section number="11" title="Changes to This Policy" delay={0.3}>
        <p>
          We may update this Privacy Policy from time to time. If we make material changes, we will
          notify users via the app or email.
        </p>
      </Section>

      <Section number="12" title="Governing Law" delay={0.32}>
        <p>
          This Privacy Policy is governed by the laws of the United States, without regard to
          conflict of law principles.
        </p>
      </Section>

      <Section number="13" title="Contact Us" delay={0.34}>
        <p>
          If you have any questions about this Privacy Policy, please contact us at{" "}
          <a
            href="mailto:zentari.contact@gmail.com"
            className="text-zinc-900 hover:underline"
          >
            zentari.contact@gmail.com
          </a>.
        </p>
      </Section>
    </article>
  );
}
