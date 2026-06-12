import React, { useState } from 'react';
import { downloadCertificate } from '@/services/certificateService';

interface Student {
  id: number;
  name: string;
  company: string;
  status: 'Completed' | 'Pending';
}

export default function CertificateTab(): React.JSX.Element {
  const [students] = useState<Student[]>([
    { id: 1, name: 'Priya Sharma', company: 'Acme Technologies Pvt. Ltd.', status: 'Completed' },
    { id: 2, name: 'Rahul Verma', company: 'Global Solutions', status: 'Completed' }
  ]);

  const [loadingId, setLoadingId] = useState<number | null>(null);

  const handleDownload = async (student: Student) => {
    setLoadingId(student.id);
    try {
      await downloadCertificate(student.name, student.company);
    } catch (error) {
      console.error(error);
      alert('Failed to generate certificate.');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="w-full bg-card text-card-foreground rounded-lg border shadow-sm overflow-hidden mt-4">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/50 transition-colors">
            <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Student Name</th>
            <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Company</th>
            <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
            <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">Action</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => (
            <tr key={student.id} className="border-b transition-colors hover:bg-muted/50">
              <td className="p-4 align-middle font-medium">{student.name}</td>
              <td className="p-4 align-middle text-muted-foreground">{student.company}</td>
              <td className="p-4 align-middle">
                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  ✓ {student.status}
                </span>
              </td>
              <td className="p-4 align-middle text-right">
                <button
                  onClick={() => handleDownload(student)}
                  disabled={loadingId === student.id}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2 disabled:opacity-50"
                >
                  {loadingId === student.id ? 'Generating...' : 'Generate & Download'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}