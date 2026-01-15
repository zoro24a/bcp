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
    console.error("[getCertificateHtml] Error: Certificate template not found.");
    return "<p>Error: Certificate template not found.</p>";
  }
  if (!student) {
    console.error("[getCertificateHtml] Error: Student details not found.");
    return "<p>Error: Student details not found.</p>";
  }

  console.log("[getCertificateHtml] Raw template content from DB:", template.content);

  // Content is now expected to be raw HTML, no unescaping needed here.
  let content = template.content || "";
  console.log("[getCertificateHtml] Content after initial processing (no unescaping):", content);

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

  console.log("[getCertificateHtml] Content after standard replacements:", content);

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

  console.log("[getCertificateHtml] Content after gender-specific replacements:", content);

  if (addSignature) {
    content +=
      "<p style='margin-top: 40px; text-align: right;'>--- E-Signed by Principal ---</p>";
  }

  console.log("[getCertificateHtml] Final HTML content generated:", content); // Debugging line
  return content;
};

/**
 * Generates and downloads a PDF from an HTML string.
 * @param htmlContent The HTML content to convert to PDF.
 * @param fileName The name of the file to be downloaded.
 */
export const generatePdf = async (htmlContent: string, fileName: string) => {
  console.log("[generatePdf] Starting PDF generation for file:", fileName);

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // Create a temporary div to render the HTML content
  const tempDiv = document.createElement("div");
  tempDiv.style.width = "210mm"; // A4 width
  tempDiv.style.padding = "20mm"; // Padding for margins
  tempDiv.style.boxSizing = "border-box"; // Include padding in width
  tempDiv.style.position = "fixed"; // Use fixed position
  tempDiv.style.top = "0";
  tempDiv.style.left = "0";
  tempDiv.style.zIndex = "-1"; // Place it behind other content
  tempDiv.style.opacity = "0"; // Make it invisible
  tempDiv.style.backgroundColor = "white"; // Ensure white background for PDF
  tempDiv.innerHTML = `<div class="prose max-w-none">${htmlContent}</div>`; // Apply prose for styling
  document.body.appendChild(tempDiv);

  // Wait briefly for rendering to complete
  await new Promise(r => setTimeout(r, 300)); // As suggested by the user

  // Use jsPDF's html method for better integration
  await pdf.html(tempDiv, {
    callback: function (doc) {
      doc.save(fileName);
      document.body.removeChild(tempDiv); // Clean up the temporary element
      console.log("[generatePdf] PDF generated and downloaded successfully.");
    },
    x: 0,
    y: 0,
    html2canvas: {
      scale: 0.8, // Adjusted scale as per user suggestion
      useCORS: true, // Important if images are from external sources
      logging: true, // Enable logging for html2canvas
    },
    margin: [10, 10, 10, 10], // Top, Right, Bottom, Left margins in mm
  });
};