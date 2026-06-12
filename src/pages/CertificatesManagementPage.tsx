import CertificateTab from "@/components/certificates/CertificateTab";

export default function CertificatesManagementPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Certificates</h1>
        <p className="text-sm text-muted-foreground">
          Generate and download completion certificates for students.
        </p>
      </div>
      <CertificateTab />
    </div>
  );
}