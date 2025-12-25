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

export default function TermsOfUse() {
  return (
    <article className="max-w-2xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12"
      >
        <h1 className="text-3xl font-bold text-zinc-900 mb-2">Terms of Use</h1>
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
        Welcome to Zentari. By accessing or using our platform, you agree to be bound by these Terms of Use.
        Please read them carefully before using our services.
      </motion.p>

      {/* Sections */}
      <Section number="1" title="Acceptance of Terms" delay={0.1}>
        <p>
          By accessing or using Zentari, you agree to be bound by these Terms of Use. If you do not
          agree to these terms, please do not use our services.
        </p>
      </Section>

      <Section number="2" title="Description of Service" delay={0.12}>
        <p>
          Zentari is a personal finance management application that allows you to connect your
          financial accounts, view transactions, track spending, and analyze your financial health.
          We provide tools and insights to help you manage your money more effectively.
        </p>
      </Section>

      <Section number="3" title="User Accounts" delay={0.14}>
        <p className="mb-4">
          To use Zentari, you must create an account. You must be at least 18 years old to use Zentari. You are responsible for:
        </p>
        <ul className="space-y-2">
          <ListItem>Maintaining the confidentiality of your account credentials</ListItem>
          <ListItem>All activities that occur under your account</ListItem>
          <ListItem>Notifying us immediately of any unauthorized access</ListItem>
        </ul>
      </Section>

      <Section number="4" title="Acceptable Use" delay={0.16}>
        <p className="mb-4">
          You agree not to:
        </p>
        <ul className="space-y-2">
          <ListItem>Use the service for any illegal purpose</ListItem>
          <ListItem>Attempt to gain unauthorized access to our systems</ListItem>
          <ListItem>Interfere with or disrupt the service</ListItem>
          <ListItem>Reverse engineer or attempt to extract source code</ListItem>
          <ListItem>Use automated systems to access the service without permission</ListItem>
        </ul>
      </Section>

      <Section number="5" title="Disclaimers" delay={0.18}>
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-100 mb-4">
          <p className="text-amber-800 text-sm">
            Zentari provides financial information and tools for informational purposes only. We are not a financial advisor.
          </p>
        </div>
        <p className="mb-4">
          Zentari is not a bank, broker-dealer, investment advisor, or fiduciary. Brokerage services
          and investment accounts are provided by third-party providers. Zentari does not execute
          trades, hold funds, or provide investment recommendations.
        </p>
        <p>
          Nothing in our service constitutes financial advice. You should consult with a qualified
          financial professional before making any financial decisions. You are solely responsible
          for any financial decisions made based on information provided through Zentari.
        </p>
      </Section>

      <Section number="6" title="Third-Party Services" delay={0.2}>
        <p>
          Zentari integrates with third-party services, including financial data providers and
          brokerage partners. We are not responsible for the availability, accuracy, or reliability
          of third-party services or data provided by them.
        </p>
      </Section>

      <Section number="7" title="No Guarantee of Accuracy" delay={0.22}>
        <p>
          Financial data displayed in Zentari is provided by third-party sources and may be delayed
          or inaccurate. Zentari does not guarantee the completeness or accuracy of any information shown.
        </p>
      </Section>

      <Section number="8" title="Limitation of Liability" delay={0.24}>
        <p className="mb-4">
          Zentari is provided "as is" without warranties of any kind. Zentari does not guarantee uninterrupted or error-free operation of the service. We are not liable for any
          damages arising from your use of the service, including but not limited to direct,
          indirect, incidental, or consequential damages. To the maximum extent permitted by law,
          Zentari's total liability shall not exceed the amount you paid to use the service, if any.
        </p>
      </Section>

      <Section number="9" title="Modifications & Termination" delay={0.26}>
        <p className="mb-4">
          We reserve the right to modify these Terms of Use at any time. We will notify users of
          significant changes. Your continued use of the service after changes constitutes acceptance
          of the new terms.
        </p>
        <p>
          We may terminate or suspend your account at any time for violation of these terms. You may
          also delete your account at any time through the settings page.
        </p>
      </Section>

      <Section number="10" title="Governing Law" delay={0.28}>
        <p>
          These Terms of Use are governed by the laws of the United States, without regard to
          conflict of law principles.
        </p>
      </Section>

      <Section number="11" title="Contact" delay={0.3}>
        <p>
          If you have any questions about these Terms of Use, please contact us at{" "}
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
