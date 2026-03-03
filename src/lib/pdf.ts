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
    "{certificateNo}": request.certificate_number || '<i>To be generated upon issue</i>',
    "{certificateNumber}": request.certificate_number || '<i>To be generated upon issue</i>',
    "{academicYear}": academicYear.toString(),
    "{issuedAt}": request.issued_at ? new Date(request.issued_at).toLocaleDateString('en-GB') : '<i>To be generated upon issue</i>',
    "{date}": new Date().toLocaleDateString('en-GB'),
    "{companyBlock}": request.company_block || '<i>[Company Selection Required]</i>',
    "{durationBlock}": request.duration_block || '<i>[Duration Selection Required]</i>',
    "{salutation}": genderMap.salutation,
    "{parentRelation}": genderMap.parentRelation,
    "{heShe}": genderMap.heShe,
    "{hisHer}": genderMap.hisHer,
  };

  // Perform replacements
  Object.entries(replacements).forEach(([placeholder, value]) => {
    // Escape special characters in placeholder for regex
    const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    content = content.replace(new RegExp(escapedPlaceholder, "g"), value);
  });

  // Replace automatic gender markers (legacy support)
  content = content
    .replace(/Mr\/Ms/g, genderMap.salutation)
    .replace(/S\/o or D\/o/g, genderMap.parentRelation)
    .replace(/He\/She/g, genderMap.heShe)
    .replace(/his\/her/g, genderMap.hisHer);

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