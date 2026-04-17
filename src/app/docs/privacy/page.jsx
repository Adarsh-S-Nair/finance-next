import { loadLegalDocument } from "../../../lib/legal";
import LegalDocumentView from "../../../components/legal/LegalDocumentView";

export const metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  const doc = loadLegalDocument("privacy");
  return <LegalDocumentView doc={doc} />;
}
