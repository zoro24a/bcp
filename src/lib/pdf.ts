import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { BonafideRequest, CertificateTemplate, StudentDetails } from "./types";
import { fetchCollegeSettings } from "@/data/appData";

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

  // Replace standard placeholders
  content = content
    .replace(/{studentName}/g, `${student.first_name} ${student.last_name || ''}`.trim())
    .replace(/{studentId}/g, student.register_number)
    .replace(/{purpose}/g, request.type)
    .replace(/{subPurpose}/g, request.sub_type || '')
    .replace(/{reason}/g, request.type)
    .replace(/{detailedReason}/g, request.reason)
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