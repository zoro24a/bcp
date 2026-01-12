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
  template: CertificateTemplate | undefined,
  addSignature: boolean = false
): string => {
  if (!template) {
    return "<p>Error: Certificate template not found.</p>";
  }
  if (!student) {
    return "<p>Error: Student details not found.</p>";
  }

  const isFemale = student.gender === "Female";
  
  // Pronoun and salutation mappings
  const genderMap = {
    salutation: isFemale ? "Ms." : "Mr.",
    parentRelation: isFemale ? "D/o" : "S/o",
    heShe: isFemale ? "She" : "He",
    hisHer: isFemale ? "her" : "his",
    himHer: isFemale ? "her" : "him"
  };

  let content = template.content || "";

  // Replace standard placeholders
  content = content
    .replace(/{studentName}/g, `${student.first_name} ${student.last_name || ''}`.trim())
    .replace(/{studentId}/g, student.register_number)
    .replace(/{purpose}/g, request.type) // Injected dynamically (e.g., Scholarship, Passport)
    .replace(/{subPurpose}/g, request.sub_type || '') // Optional sub-type
    .replace(/{reason}/g, request.type) // Legacy support for {reason}
    .replace(/{detailedReason}/g, request.reason) // The actual reason text provided by the student
    .replace(/{parentName}/g, student.parent_name || 'N/A')
    .replace(/{department}/g, student.department_name || 'N/A')
    .replace(/{batch}/g, student.batch_name || 'N/A')
    .replace(/{currentSemester}/g, student.current_semester?.toString() || 'N/A')
    .replace(/{date}/g, new Date().toLocaleDateString('en-GB'));

  // Replace automatic gender markers
  content = content
    .replace(/Mr\/Ms/g, genderMap.salutation)
    .replace(/S\/o or D\/o/g, genderMap.parentRelation)
    .replace(/He\/She/g, genderMap.heShe)
    .replace(/his\/her/g, genderMap.hisHer)
    .replace(/\bHe\b/g, genderMap.heShe)
    .replace(/\bhis\b/g, genderMap.hisHer);

  // Explicit gender placeholders
  content = content
    .replace(/{salutation}/g, genderMap.salutation)
    .replace(/{parentRelation}/g, genderMap.parentRelation)
    .replace(/{heShe}/g, genderMap.heShe)
    .replace(/{hisHer}/g, genderMap.hisHer);

  if (addSignature) {
    content +=
      "<p style='margin-top: 40px; text-align: right;'>--- E-Signed by Principal ---</p>";
  }

  return content;
};

/**
 * Generates and downloads a PDF from an HTML string.
 * @param htmlContent The HTML content to convert to PDF.
 * @param fileName The name of the file to be downloaded.
 */
export const generatePdf = async (htmlContent: string, fileName: string) => {
  const container = document.createElement("div");
  container.style.width = "210mm";
  container.style.padding = "20mm";
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.innerHTML = `<div class="prose max-w-none">${htmlContent}</div>`;
  document.body.appendChild(container);

  const canvas = await html2canvas(container, { scale: 2 });
  document.body.removeChild(container);

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  const ratio = canvasWidth / canvasHeight;
  const imgWidth = pdfWidth;
  const imgHeight = imgWidth / ratio;

  pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
  pdf.save(fileName);
};