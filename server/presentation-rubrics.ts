import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";

export type PresentationType = "ORAL" | "POSTER";

export interface PresentationRubricLevel {
  level: 1 | 2 | 3 | 4 | 5;
  titleTh: string;
  titleEn: string;
  descriptionTh: string;
  descriptionEn: string;
}

export interface PresentationRubricCriterion {
  id: string;
  nameTh: string;
  nameEn: string;
  descriptionTh: string;
  descriptionEn: string;
  totalPoints: number;
  levels: PresentationRubricLevel[];
}

const LEVEL_TITLES: Record<1 | 2 | 3 | 4 | 5, { th: string; en: string }> = {
  5: { th: "ดีเยี่ยม", en: "Excellent" },
  4: { th: "ดี", en: "Good" },
  3: { th: "ปานกลาง", en: "Fair" },
  2: { th: "ควรปรับปรุง", en: "Needs Improvement" },
  1: { th: "ควรปรับปรุงอย่างมาก", en: "Poor" },
};

function createLevels(
  descriptions: Record<1 | 2 | 3 | 4 | 5, { th: string; en: string }>
): PresentationRubricLevel[] {
  const orderedLevels: Array<1 | 2 | 3 | 4 | 5> = [5, 4, 3, 2, 1];

  return orderedLevels.map((level) => ({
    level,
    titleTh: LEVEL_TITLES[level].th,
    titleEn: LEVEL_TITLES[level].en,
    descriptionTh: descriptions[level].th,
    descriptionEn: descriptions[level].en,
  }));
}

export const DEFAULT_PRESENTATION_RUBRICS: Record<
  PresentationType,
  PresentationRubricCriterion[]
> = {
  POSTER: [
    {
      id: "poster-appearance",
      nameTh: "รูปแบบและความเหมาะสมของโปสเตอร์",
      nameEn: "Poster Appearance",
      descriptionTh:
        "พิจารณารูปแบบโปสเตอร์ ความเหมาะสมของสีสัน ตัวอักษร ขนาดตัวอักษร และขนาดภาพ",
      descriptionEn:
        "Evaluate the poster layout, visual design, use of color, typography, font size, and image sizing.",
      totalPoints: 20,
      levels: createLevels({
        5: {
          th: "โปสเตอร์มีความสวยงาม เป็นระเบียบ อ่านง่ายมาก การใช้สี ตัวอักษร และภาพเหมาะสมอย่างยิ่ง",
          en: "The poster is highly polished, well organized, and very easy to read. Color, typography, and images are used exceptionally well.",
        },
        4: {
          th: "โปสเตอร์มีความเหมาะสม อ่านง่าย และจัดวางองค์ประกอบได้ดี มีข้อบกพร่องเพียงเล็กน้อย",
          en: "The poster is appropriate, easy to read, and well arranged, with only minor issues.",
        },
        3: {
          th: "โปสเตอร์อยู่ในระดับพอใช้ อ่านได้ แต่การจัดวางหรือรูปแบบยังไม่สม่ำเสมอบางส่วน",
          en: "The poster is acceptable and readable, though the layout or formatting is inconsistent in some areas.",
        },
        2: {
          th: "โปสเตอร์มีการจัดวางไม่เหมาะสมหลายจุด อ่านยากบางส่วน หรือมีองค์ประกอบรบกวนการสื่อสาร",
          en: "The poster has several layout problems, is difficult to read in places, or includes distracting design choices.",
        },
        1: {
          th: "โปสเตอร์ขาดความชัดเจนและการออกแบบที่เหมาะสม ทำให้อ่านและทำความเข้าใจได้ยากมาก",
          en: "The poster lacks clarity and appropriate design, making it very difficult to read and understand.",
        },
      }),
    },
    {
      id: "poster-organization",
      nameTh: "การเรียงลำดับข้อมูล",
      nameEn: "Organization",
      descriptionTh: "พิจารณาการเรียงลำดับข้อมูลบนโปสเตอร์และความสะดวกในการติดตามเนื้อหา",
      descriptionEn:
        "Evaluate the sequence of information on the poster and how easily the audience can follow the content.",
      totalPoints: 10,
      levels: createLevels({
        5: {
          th: "ข้อมูลเรียงลำดับอย่างเป็นระบบ ชัดเจน และติดตามได้อย่างต่อเนื่อง",
          en: "Information is organized systematically, clearly, and in a smooth logical flow.",
        },
        4: {
          th: "ข้อมูลมีการจัดลำดับที่ดี เข้าใจง่าย และมีความต่อเนื่องโดยรวม",
          en: "Information is arranged well, easy to understand, and generally coherent.",
        },
        3: {
          th: "ข้อมูลเรียงลำดับได้พอใช้ แต่ยังมีบางส่วนที่ไม่ต่อเนื่องหรือทำให้ต้องตีความเพิ่ม",
          en: "Information is organized at a fair level, though some sections are disconnected or require extra interpretation.",
        },
        2: {
          th: "การจัดลำดับข้อมูลยังไม่ชัดเจน ทำให้เกิดความสับสนในหลายส่วน",
          en: "The organization is unclear and causes confusion in several parts.",
        },
        1: {
          th: "การจัดลำดับข้อมูลไม่เป็นระบบ ส่งผลให้เข้าใจเนื้อหาได้ยาก",
          en: "The information is poorly organized and difficult to follow.",
        },
      }),
    },
    {
      id: "poster-significance",
      nameTh: "ความสำคัญของปัญหาและวัตถุประสงค์",
      nameEn: "Significance",
      descriptionTh: "พิจารณาความสำคัญของปัญหาและความชัดเจนของวัตถุประสงค์",
      descriptionEn:
        "Evaluate the significance of the problem and the clarity of the objectives.",
      totalPoints: 15,
      levels: createLevels({
        5: {
          th: "แสดงความสำคัญของปัญหาและวัตถุประสงค์ได้อย่างชัดเจน ครบถ้วน และมีน้ำหนักทางวิชาการ",
          en: "The significance of the problem and the objectives are presented with excellent clarity, completeness, and academic strength.",
        },
        4: {
          th: "อธิบายความสำคัญของปัญหาและวัตถุประสงค์ได้ชัดเจนเป็นส่วนใหญ่",
          en: "The significance of the problem and the objectives are mostly clear and well explained.",
        },
        3: {
          th: "อธิบายได้ในระดับพอใช้ แต่ยังขาดความชัดเจนหรือความครบถ้วนบางประการ",
          en: "The significance and objectives are explained at an acceptable level, but some aspects remain unclear or incomplete.",
        },
        2: {
          th: "ความสำคัญของปัญหาหรือวัตถุประสงค์ยังไม่ชัดเจนเพียงพอ",
          en: "The significance of the problem or the objectives is insufficiently clear.",
        },
        1: {
          th: "ไม่สามารถแสดงความสำคัญของปัญหาและวัตถุประสงค์ได้อย่างชัดเจน",
          en: "The significance of the problem and the objectives are not clearly presented.",
        },
      }),
    },
    {
      id: "poster-results",
      nameTh: "ผลการวิจัย/ออกแบบและการอภิปรายผล",
      nameEn: "Results",
      descriptionTh:
        "พิจารณาการนำเสนอผลการวิจัย/ออกแบบ ความสอดคล้องกับวัตถุประสงค์ การใช้ข้อมูลสนับสนุน และการอภิปรายผล",
      descriptionEn:
        "Evaluate the presentation of research/design results, their alignment with the objectives, supporting evidence, and the discussion.",
      totalPoints: 30,
      levels: createLevels({
        5: {
          th: "นำเสนอผลได้ครบถ้วน ชัดเจน มีข้อมูลหรือตัวเลขสนับสนุนอย่างเหมาะสม และอภิปรายผลเชื่อมโยงกับทฤษฎีหรือผลงานที่เกี่ยวข้องได้ดีเยี่ยม",
          en: "Results are complete and clearly presented with appropriate supporting data, and the discussion connects exceptionally well to theory or related work.",
        },
        4: {
          th: "นำเสนอผลได้ชัดเจน มีข้อมูลสนับสนุนเพียงพอ และอภิปรายผลได้เหมาะสม",
          en: "Results are clearly presented with sufficient supporting evidence and an appropriate discussion.",
        },
        3: {
          th: "นำเสนอผลได้ในระดับพอใช้ แต่ข้อมูลสนับสนุนหรือการอภิปรายผลยังไม่ชัดเจนเพียงพอ",
          en: "Results are presented at a fair level, but the supporting evidence or discussion is not sufficiently clear.",
        },
        2: {
          th: "การนำเสนอผลยังขาดความชัดเจน ข้อมูลสนับสนุนมีจำกัด และการอภิปรายผลยังไม่สมเหตุสมผล",
          en: "The results are unclear, supporting evidence is limited, and the discussion lacks sound reasoning.",
        },
        1: {
          th: "การนำเสนอผลไม่ชัดเจน ขาดข้อมูลสนับสนุน และไม่สามารถอภิปรายผลได้อย่างเหมาะสม",
          en: "The results are unclear, lack supporting evidence, and are not discussed appropriately.",
        },
      }),
    },
    {
      id: "poster-presentation",
      nameTh: "การนำเสนอและการตอบคำถาม",
      nameEn: "Presentation",
      descriptionTh: "พิจารณาลักษณะการนำเสนอ ท่าทาง น้ำเสียง และการตอบคำถาม",
      descriptionEn:
        "Evaluate the delivery style, posture, tone of voice, and ability to answer questions.",
      totalPoints: 25,
      levels: createLevels({
        5: {
          th: "นำเสนอได้อย่างมั่นใจ ชัดเจน น่าสนใจ ใช้ท่าทางและน้ำเสียงเหมาะสม และตอบคำถามได้ตรงประเด็นอย่างดีเยี่ยม",
          en: "The presenter is confident, clear, and engaging, uses appropriate body language and tone, and answers questions exceptionally well.",
        },
        4: {
          th: "นำเสนอได้ดี มีความชัดเจนและความเหมาะสมในการสื่อสาร ตอบคำถามได้ดี",
          en: "The presentation is clear and effective, with good communication and solid responses to questions.",
        },
        3: {
          th: "นำเสนอได้ในระดับพอใช้ และตอบคำถามได้บางส่วน",
          en: "The presentation is acceptable and the presenter can answer some questions.",
        },
        2: {
          th: "การนำเสนอยังไม่ชัดเจน ขาดความมั่นใจ และตอบคำถามได้อย่างจำกัด",
          en: "The presentation lacks clarity and confidence, and responses to questions are limited.",
        },
        1: {
          th: "การนำเสนอไม่ชัดเจน ขาดความพร้อม และไม่สามารถตอบคำถามได้อย่างเหมาะสม",
          en: "The presentation is unclear, poorly prepared, and unable to address questions appropriately.",
        },
      }),
    },
  ],
  ORAL: [
    {
      id: "oral-significance",
      nameTh: "ความสำคัญของปัญหาและวัตถุประสงค์",
      nameEn: "Significance",
      descriptionTh: "พิจารณาความสำคัญของปัญหาและความชัดเจนของวัตถุประสงค์",
      descriptionEn:
        "Evaluate the significance of the problem and the clarity of the objectives.",
      totalPoints: 15,
      levels: createLevels({
        5: {
          th: "นำเสนอความสำคัญของปัญหาและวัตถุประสงค์ได้อย่างชัดเจน ครบถ้วน และน่าสนใจ",
          en: "The significance of the problem and the objectives are presented with excellent clarity, completeness, and impact.",
        },
        4: {
          th: "อธิบายความสำคัญของปัญหาและวัตถุประสงค์ได้ชัดเจนเป็นส่วนใหญ่",
          en: "The significance of the problem and the objectives are mostly clear and well explained.",
        },
        3: {
          th: "อธิบายได้พอใช้ แต่ยังขาดความชัดเจนในบางส่วน",
          en: "They are explained at a fair level, but some parts remain unclear.",
        },
        2: {
          th: "ความสำคัญของปัญหาหรือวัตถุประสงค์ยังไม่ชัดเจนเพียงพอ",
          en: "The significance of the problem or the objectives is insufficiently clear.",
        },
        1: {
          th: "ไม่สามารถอธิบายความสำคัญของปัญหาและวัตถุประสงค์ได้อย่างชัดเจน",
          en: "The significance of the problem and the objectives are not clearly explained.",
        },
      }),
    },
    {
      id: "oral-results",
      nameTh: "ผลการวิจัย/ออกแบบและการอภิปรายผล",
      nameEn: "Results",
      descriptionTh:
        "พิจารณาการนำเสนอผลการวิจัย/ออกแบบ ความน่าเชื่อถือของข้อมูล ความสอดคล้องกับวัตถุประสงค์ และการอภิปรายผล",
      descriptionEn:
        "Evaluate the presentation of research/design results, the credibility of the evidence, alignment with the objectives, and the discussion.",
      totalPoints: 30,
      levels: createLevels({
        5: {
          th: "นำเสนอผลได้อย่างชัดเจน มีข้อมูลหรือตัวเลขอ้างอิงที่น่าเชื่อถือ สอดคล้องกับวัตถุประสงค์ และอภิปรายผลได้อย่างมีเหตุผลพร้อมเชื่อมโยงกับหลักการหรือผลงานที่เกี่ยวข้องได้อย่างเหมาะสม",
          en: "Results are presented clearly with credible supporting data, align strongly with the objectives, and are discussed with sound reasoning and strong connections to relevant theory or work.",
        },
        4: {
          th: "นำเสนอผลได้ดี มีข้อมูลสนับสนุนเหมาะสม และอภิปรายผลได้ชัดเจน",
          en: "Results are presented well, supported by appropriate evidence, and discussed clearly.",
        },
        3: {
          th: "นำเสนอผลได้พอใช้ แต่ความชัดเจนหรือการอภิปรายผลยังไม่สมบูรณ์",
          en: "Results are presented at a fair level, but clarity or discussion remains incomplete.",
        },
        2: {
          th: "การนำเสนอผลยังไม่ชัดเจน ข้อมูลสนับสนุนไม่เพียงพอ และการอภิปรายผลยังขาดเหตุผลรองรับ",
          en: "The results are unclear, evidence is insufficient, and the discussion lacks adequate justification.",
        },
        1: {
          th: "ผลการนำเสนอขาดความชัดเจนและความน่าเชื่อถือ ไม่สามารถอภิปรายผลได้เหมาะสม",
          en: "The presented results lack clarity and credibility, and the discussion is inadequate.",
        },
      }),
    },
    {
      id: "oral-organization",
      nameTh: "การจัดลำดับเนื้อหาและการบริหารเวลา",
      nameEn: "Organization",
      descriptionTh: "พิจารณาการจัดลำดับเนื้อหา ความต่อเนื่องของการนำเสนอ และความเหมาะสมในการบริหารเวลา",
      descriptionEn:
        "Evaluate the organization of content, continuity of the presentation, and time management.",
      totalPoints: 20,
      levels: createLevels({
        5: {
          th: "การนำเสนอมีลำดับเนื้อหาชัดเจน ต่อเนื่อง น่าสนใจ และบริหารเวลาได้อย่างเหมาะสมมาก",
          en: "The presentation is highly organized, coherent, engaging, and managed within the allotted time very effectively.",
        },
        4: {
          th: "การนำเสนอมีลำดับที่ดี ต่อเนื่อง และใช้เวลาได้เหมาะสม",
          en: "The presentation is well organized, coherent, and uses time appropriately.",
        },
        3: {
          th: "โครงสร้างการนำเสนออยู่ในระดับพอใช้ แต่ยังมีบางช่วงที่ไม่ต่อเนื่องหรือใช้เวลาไม่สมดุล",
          en: "The structure is fair, though some parts are disconnected or time is unevenly allocated.",
        },
        2: {
          th: "การจัดลำดับเนื้อหายังไม่ชัดเจน หรือการใช้เวลาไม่เหมาะสม",
          en: "The organization is unclear or the time management is inappropriate.",
        },
        1: {
          th: "การนำเสนอขาดความเป็นลำดับ ไม่ต่อเนื่อง และบริหารเวลาไม่เหมาะสมอย่างชัดเจน",
          en: "The presentation lacks organization, coherence, and effective time management.",
        },
      }),
    },
    {
      id: "oral-delivery",
      nameTh: "ทักษะการนำเสนอ",
      nameEn: "Delivery",
      descriptionTh: "พิจารณาทักษะการพูด น้ำเสียง ความชัดเจนในการสื่อสาร และการใช้ภาษากาย",
      descriptionEn:
        "Evaluate speaking skills, tone of voice, clarity of communication, and body language.",
      totalPoints: 10,
      levels: createLevels({
        5: {
          th: "สื่อสารได้อย่างชัดเจน มั่นใจ น้ำเสียงเหมาะสม และใช้ภาษากายสนับสนุนการนำเสนอได้อย่างมีประสิทธิภาพ",
          en: "Communication is clear and confident, with an appropriate tone and highly effective body language.",
        },
        4: {
          th: "สื่อสารได้ดี มีความมั่นใจ และใช้ท่าทางประกอบได้เหมาะสม",
          en: "The presenter communicates well, shows confidence, and uses body language appropriately.",
        },
        3: {
          th: "สื่อสารได้พอใช้ แต่ยังขาดความต่อเนื่องหรือความมั่นใจบางส่วน",
          en: "Communication is fair, though continuity or confidence is somewhat lacking.",
        },
        2: {
          th: "การสื่อสารยังไม่ชัดเจน ขาดความมั่นใจ หรือใช้ภาษากายไม่เหมาะสม",
          en: "Communication is unclear, lacks confidence, or uses body language ineffectively.",
        },
        1: {
          th: "การสื่อสารไม่ชัดเจนอย่างมาก ทำให้ผู้ฟังเข้าใจเนื้อหาได้ยาก",
          en: "Communication is very unclear and makes the content difficult to understand.",
        },
      }),
    },
    {
      id: "oral-language",
      nameTh: "การใช้ภาษาอังกฤษ",
      nameEn: "Language",
      descriptionTh: "พิจารณาความถูกต้องและความเหมาะสมในการใช้ภาษาอังกฤษ",
      descriptionEn:
        "Evaluate the correctness and appropriateness of English usage.",
      totalPoints: 15,
      levels: createLevels({
        5: {
          th: "ใช้ภาษาอังกฤษได้ถูกต้อง เหมาะสม คล่องแคล่ว และสื่อสารได้อย่างมีประสิทธิภาพ",
          en: "English is used accurately, appropriately, fluently, and effectively.",
        },
        4: {
          th: "ใช้ภาษาอังกฤษได้ดี มีข้อผิดพลาดเพียงเล็กน้อยที่ไม่กระทบต่อความเข้าใจ",
          en: "English is used well, with only minor errors that do not affect understanding.",
        },
        3: {
          th: "ใช้ภาษาอังกฤษได้พอใช้ มีข้อผิดพลาดบ้างแต่ยังสื่อความหมายได้",
          en: "English is acceptable, with some errors but overall understandable.",
        },
        2: {
          th: "มีข้อผิดพลาดด้านภาษาในหลายส่วน และเริ่มส่งผลต่อความเข้าใจ",
          en: "There are multiple language errors and they begin to interfere with understanding.",
        },
        1: {
          th: "มีข้อผิดพลาดด้านภาษาจำนวนมาก ส่งผลกระทบอย่างชัดเจนต่อการสื่อสาร",
          en: "There are substantial language errors that clearly impair communication.",
        },
      }),
    },
    {
      id: "oral-responsiveness",
      nameTh: "การตอบคำถามและการโต้ตอบกับผู้ฟัง",
      nameEn: "Responsiveness",
      descriptionTh: "พิจารณาความสามารถในการตอบคำถามและการโต้ตอบกับผู้ฟัง",
      descriptionEn:
        "Evaluate the ability to respond to questions and interact with the audience.",
      totalPoints: 10,
      levels: createLevels({
        5: {
          th: "ตอบคำถามได้ตรงประเด็น ชัดเจน มีเหตุผล และสามารถโต้ตอบกับผู้ฟังได้อย่างเหมาะสม",
          en: "Questions are answered clearly, directly, and with sound reasoning, and the presenter interacts effectively with the audience.",
        },
        4: {
          th: "ตอบคำถามได้ดีและค่อนข้างตรงประเด็น",
          en: "Questions are answered well and mostly on point.",
        },
        3: {
          th: "ตอบคำถามได้บางส่วน แต่ยังขาดความชัดเจนหรือความสมบูรณ์",
          en: "Some questions are answered, but responses lack clarity or completeness.",
        },
        2: {
          th: "ตอบคำถามได้จำกัด หรือไม่ค่อยตรงประเด็น",
          en: "Responses are limited or not sufficiently on point.",
        },
        1: {
          th: "ไม่สามารถตอบคำถามได้อย่างเหมาะสม หรือไม่ตรงประเด็น",
          en: "The presenter is unable to answer questions appropriately or accurately.",
        },
      }),
    },
  ],
};

const RUBRIC_SETTING_KEYS: Record<PresentationType, string> = {
  ORAL: "presentationRubric.ORAL",
  POSTER: "presentationRubric.POSTER",
};

function cloneDefaults(
  type: PresentationType
): PresentationRubricCriterion[] {
  return structuredClone(DEFAULT_PRESENTATION_RUBRICS[type]);
}

function isLevel(input: unknown): input is PresentationRubricLevel {
  if (!input || typeof input !== "object") return false;
  const level = (input as { level?: unknown }).level;
  return (
    (level === 1 || level === 2 || level === 3 || level === 4 || level === 5) &&
    typeof (input as { titleTh?: unknown }).titleTh === "string" &&
    typeof (input as { titleEn?: unknown }).titleEn === "string" &&
    typeof (input as { descriptionTh?: unknown }).descriptionTh === "string" &&
    typeof (input as { descriptionEn?: unknown }).descriptionEn === "string"
  );
}

function isCriterion(input: unknown): input is PresentationRubricCriterion {
  if (!input || typeof input !== "object") return false;

  const levels = (input as { levels?: unknown }).levels;
  return (
    typeof (input as { id?: unknown }).id === "string" &&
    typeof (input as { nameTh?: unknown }).nameTh === "string" &&
    typeof (input as { nameEn?: unknown }).nameEn === "string" &&
    typeof (input as { descriptionTh?: unknown }).descriptionTh === "string" &&
    typeof (input as { descriptionEn?: unknown }).descriptionEn === "string" &&
    typeof (input as { totalPoints?: unknown }).totalPoints === "number" &&
    Array.isArray(levels) &&
    levels.length === 5 &&
    levels.every(isLevel)
  );
}

function sanitizeCriteria(
  criteria: PresentationRubricCriterion[]
): PresentationRubricCriterion[] {
  return criteria.map((criterion) => ({
    ...criterion,
    id: criterion.id.trim(),
    nameTh: criterion.nameTh.trim(),
    nameEn: criterion.nameEn.trim(),
    descriptionTh: criterion.descriptionTh.trim(),
    descriptionEn: criterion.descriptionEn.trim(),
    totalPoints: Math.max(0, Math.round(criterion.totalPoints)),
    levels: [...criterion.levels]
      .sort((a, b) => b.level - a.level)
      .map((level) => ({
        ...level,
        titleTh: level.titleTh.trim(),
        titleEn: level.titleEn.trim(),
        descriptionTh: level.descriptionTh.trim(),
        descriptionEn: level.descriptionEn.trim(),
      })),
  }));
}

export async function getPresentationRubric(
  type: PresentationType
): Promise<PresentationRubricCriterion[]> {
  const key = RUBRIC_SETTING_KEYS[type];
  const row = await db.query.settings.findFirst({
    where: eq(settings.key, key),
  });

  if (Array.isArray(row?.value) && row.value.every(isCriterion)) {
    return sanitizeCriteria(row.value);
  }

  const defaults = cloneDefaults(type);
  await db
    .insert(settings)
    .values({
      key,
      value: defaults,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: {
        value: defaults,
        updatedAt: new Date(),
      },
    });

  return defaults;
}

export async function getPresentationRubrics(
  types: PresentationType[]
): Promise<Record<PresentationType, PresentationRubricCriterion[]>> {
  const uniqueTypes = Array.from(new Set(types));
  const entries = await Promise.all(
    uniqueTypes.map(async (type) => [type, await getPresentationRubric(type)] as const)
  );

  return Object.fromEntries(entries) as Record<
    PresentationType,
    PresentationRubricCriterion[]
  >;
}

export async function savePresentationRubric(
  type: PresentationType,
  criteria: PresentationRubricCriterion[]
) {
  const sanitized = sanitizeCriteria(criteria);

  await db
    .insert(settings)
    .values({
      key: RUBRIC_SETTING_KEYS[type],
      value: sanitized,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: {
        value: sanitized,
        updatedAt: new Date(),
      },
    });

  return sanitized;
}
