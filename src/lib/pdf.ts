import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { BonafideRequest, CertificateTemplate, StudentDetails } from "./types";

/**
 * Generates the final HTML content for a certificate by populating a template with data.
 * @param request The bonafide request.
 * @param student The student's profile.
 * @param template The certificate template.
 * @param addSignature A boolean to indicate if the admin signature should be added.
 * @returns The final HTML string for the certificate.
 */
export const getCertificateHtml = (
  request: BonafideRequest,
  student: StudentDetails | null,
  template: CertificateTemplate | undefined
): string => {
  if (!template) {
    console.error("[getCertificateHtml] Error: Certificate template not found.");
    return "<p>Error: Certificate template not found.</p>";
  }
  if (!student) {
    console.error("[getCertificateHtml] Error: Student details not found.");
    return "<p>Error: Student details not found.</p>";
  }

  // Content is now expected to be raw HTML
  let content = template.content || "";

  // Ensure gender defaults to 'Male' if not explicitly set
  const isFemale = student.gender === "Female";

  // Pronoun and salutation mappings
  const genderMap = {
    salutation: isFemale ? "Ms." : "Mr.",
    parentRelation: isFemale ? "D/o" : "S/o",
    heShe: isFemale ? "She" : "He",
    hisHer: isFemale ? "her" : "his",
    himHer: isFemale ? "her" : "him"
  };

  // Determine academic year (June boundary)
  const dateObj = request.issued_at ? new Date(request.issued_at) : new Date();
  const currentMonth = dateObj.getMonth() + 1;
  const academicYear = currentMonth >= 6 ? dateObj.getFullYear() : dateObj.getFullYear() - 1;

  // Placeholder replacement mapping
  const replacements: Record<string, string> = {
    "{studentName}": `${student.first_name} ${student.last_name || ''}`.trim(),
    "{registerNumber}": student.register_number || "N/A",
    "{studentId}": student.register_number || "N/A",
    "{purpose}": request.type,
    "{subPurpose}": request.sub_type || '',
    "{reason}": request.type,
    "{detailedReason}": request.reason,
    "{parentName}": student.parent_name || 'N/A',
    "{department}": student.department_name || 'N/A',
    "{specialization}": request.specialization_snapshot || student.specialization || 'N/A',
    "{batch}": student.batch_name || 'N/A',
    "{currentSemester}": student.current_semester?.toString() || 'N/A',
    "{certificateNo}": request.certificate_number || 'To be generated upon issue',
    "{certificateNumber}": request.certificate_number || 'To be generated upon issue',
    "{certificate_no}": request.certificate_number || 'To be generated upon issue',
    "{certificate_number}": request.certificate_number || 'To be generated upon issue',
    "{sl_no}": request.certificate_number || 'To be generated upon issue',
    "{slNo}": request.certificate_number || 'To be generated upon issue',
    "{academicYear}": academicYear.toString(),
    "{issuedAt}": request.issued_at ? new Date(request.issued_at).toLocaleDateString('en-GB') : 'To be generated upon issue',
    "{date}": new Date().toLocaleDateString('en-GB'),
    "{companyBlock}": request.company_block || '[Company Selection Required]',
    "{durationBlock}": request.duration_block || '[Duration Selection Required]',
    "{salutation}": genderMap.salutation,
    "{parentRelation}": genderMap.parentRelation,
    "{heShe}": genderMap.heShe,
    "{hisHer}": genderMap.hisHer,
  };

  // Perform replacements with flexible regex (handles spaces like { certificateNo })
  Object.entries(replacements).forEach(([placeholder, value]) => {
    // Strip the braces for the generic name
    const genericName = placeholder.slice(1, -1);
    // Create a regex that is case-insensitive and allows whitespace inside braces
    const flexibleRegex = new RegExp(`\\{\\s*${genericName}\\s*\\}`, "gi");
    content = content.replace(flexibleRegex, value);
  });

  // FINAL SAFETY FALLBACK: If certificate_number exists but the placeholder "To be generated upon issue" 
  // is still in the text, replace it directly. This handles cases where the template 
  // has hardcoded the fallback text instead of a placeholder.
  if (request.status === 'Issued' && request.certificate_number) {
    // Replace the literal string "To be generated upon issue" (with or without tags)
    content = content.replace(/To be generated upon issue/gi, request.certificate_number);
  }

  // Replace automatic gender markers (legacy support)
  content = content
    .replace(/Mr\/Ms/g, genderMap.salutation)
    .replace(/S\/o or D\/o/g, genderMap.parentRelation)
    .replace(/He\/She/g, genderMap.heShe)
    .replace(/his\/her/g, genderMap.hisHer);

  // Remove Principal Signature and College Seal images (broken placeholders)
  content = content.replace(/<img[^>]*alt=["'](Principal Signature|College Seal)["'][^>]*>/gi, '');

  return content;
};

/**
 * Generates and downloads a PDF from an HTML string.
 * @param htmlContent The HTML content to convert to PDF.
 * @param fileName The name of the file to be downloaded.
 */
export const generatePdf = async (htmlContent: string, fileName: string) => {
  if (!htmlContent || htmlContent.trim() === "") {
    throw new Error("HTML content is empty, cannot generate PDF.");
  }

  const tempDiv = document.createElement("div");
  tempDiv.style.width = "210mm";
  tempDiv.style.padding = "20mm";
  tempDiv.style.boxSizing = "border-box";
  tempDiv.style.position = "absolute";
  tempDiv.style.zIndex = "-1000";
  tempDiv.style.visibility = "hidden";
  tempDiv.style.top = "0";
  tempDiv.style.left = "0";
  tempDiv.style.backgroundColor = "white";
  tempDiv.innerHTML = `<div class="prose max-w-none">${htmlContent}</div>`;
  document.body.appendChild(tempDiv);

  try {
    await document.fonts.ready;
    await new Promise(r => setTimeout(r, 500));
    tempDiv.style.visibility = "visible";

    const canvas = await html2canvas(tempDiv, {
      scale: 2,
      useCORS: true,
      logging: false,
      windowWidth: tempDiv.offsetWidth,
      windowHeight: tempDiv.offsetHeight,
      allowTaint: true,
      backgroundColor: "#ffffff",
    });

    tempDiv.style.visibility = "hidden";

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(fileName);
  } catch (error) {
    console.error("[generatePdf] Error:", error);
    throw new Error("Failed to generate PDF: " + (error as Error).message);
  } finally {
    if (document.body.contains(tempDiv)) {
      document.body.removeChild(tempDiv);
    }
  }
};

/**
 * Triggers the browser print dialog for the given HTML content.
 * @param htmlContent The HTML content to print.
 */
export const printHtml = (htmlContent: string) => {
  if (!htmlContent || htmlContent.trim() === "") {
    console.error("[printHtml] Error: HTML content is empty.");
    return;
  }

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) {
    console.error("[printHtml] Error: Could not access iframe document.");
    return;
  }

  doc.open();
  doc.write(`
    <html>
      <head>
        <title>Print Certificate</title>
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
        <style>
          @page { size: auto; margin: 20mm; }
          body { font-family: sans-serif; }
          .prose { max-width: none; }
        </style>
      </head>
      <body class="p-8">
        <div class="prose max-w-none">
          ${htmlContent}
        </div>
        <script>
          window.onload = () => {
            window.print();
            setTimeout(() => {
              window.parent.document.body.removeChild(window.frameElement);
            }, 100);
          };
        </script>
      </body>
    </html>
  `);
  doc.close();
};