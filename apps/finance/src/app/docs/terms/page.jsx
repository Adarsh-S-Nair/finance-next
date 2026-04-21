import { loadLegalDocument } from "../../../lib/legal";
import LegalDocumentView from "../../../components/legal/LegalDocumentView";

export const metadata = {
  title: "Terms of Use",
};

export default function TermsPage() {
  const doc = loadLegalDocument("terms");
  return <LegalDocumentView doc={doc} />;
}
