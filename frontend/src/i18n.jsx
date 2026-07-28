import { createContext, useContext, useState, useEffect } from 'react';

const translations = {
  EN: {
    "FinAI": "FinAI",
    "New Analysis": "New Analysis",
    "Chat History": "Chat History",
    "No previous chats.": "No previous chats.",
    "Untitled Session": "Untitled Session",
    "Comparisons": "Comparisons",
    "I've initialized this session. Please upload your documents or type a query to begin.": "I've initialized this session. Please upload your documents or type a query to begin.",
    "Ask about your documents...": "Ask about your documents...",
    "Upload a document to begin...": "Upload a document to begin...",
    "FinAI can make mistakes. Check important financial info.": "FinAI can make mistakes. Check important financial info.",
    "source": "source",
    "sources": "sources",
    "match": "match",
    "Welcome to Finsight": "Welcome to Finsight",
    "Your AI-powered financial analyst. Upload reports, compare companies, and extract precise insights instantly.": "Your AI-powered financial analyst. Upload reports, compare companies, and extract precise insights instantly.",
    "Report Analysis": "Report Analysis",
    "Extract metrics and insights from financial reports like 10-Ks and earnings calls.": "Extract metrics and insights from financial reports like 10-Ks and earnings calls.",
    "Market Comparison": "Market Comparison",
    "Compare multiple companies side-by-side on key performance indicators.": "Compare multiple companies side-by-side on key performance indicators.",
    "Portfolio Advisor": "Portfolio Advisor",
    "Get AI recommendations for portfolio balancing based on market trends.": "Get AI recommendations for portfolio balancing based on market trends.",
    "You": "You",
    "Uploading...": "Uploading...",
    "Failed": "Failed",
    "Settings": "Settings",
    "Log out": "Log out"
  },
  VN: {
    "FinAI": "FinAI",
    "New Analysis": "Phân tích mới",
    "Chat History": "Lịch sử Chat",
    "No previous chats.": "Chưa có đoạn chat nào.",
    "Untitled Session": "Phiên chưa đặt tên",
    "Comparisons": "So sánh thị trường",
    "I've initialized this session. Please upload your documents or type a query to begin.": "Tôi đã khởi tạo phiên này. Vui lòng tải tài liệu lên hoặc nhập câu hỏi để bắt đầu.",
    "Ask about your documents...": "Hỏi về tài liệu của bạn...",
    "Upload a document to begin...": "Tải tài liệu lên để bắt đầu...",
    "FinAI can make mistakes. Check important financial info.": "FinAI có thể mắc lỗi. Hãy kiểm tra lại các thông tin tài chính quan trọng.",
    "source": "nguồn",
    "sources": "nguồn",
    "match": "độ trùng khớp",
    "Welcome to Finsight": "Chào mừng đến với Finsight",
    "Your AI-powered financial analyst. Upload reports, compare companies, and extract precise insights instantly.": "Chuyên gia phân tích tài chính AI của bạn. Tải báo cáo, so sánh công ty và trích xuất thông tin chi tiết ngay lập tức.",
    "Report Analysis": "Phân tích báo cáo",
    "Extract metrics and insights from financial reports like 10-Ks and earnings calls.": "Trích xuất các chỉ số và thông tin chi tiết từ các báo cáo tài chính (10-K, báo cáo thu nhập).",
    "Market Comparison": "So sánh thị trường",
    "Compare multiple companies side-by-side on key performance indicators.": "So sánh song song nhiều công ty dựa trên các chỉ số hiệu suất chính (KPIs).",
    "Portfolio Advisor": "Cố vấn đầu tư",
    "Get AI recommendations for portfolio balancing based on market trends.": "Nhận đề xuất từ AI để tối ưu hóa và cân bằng danh mục đầu tư.",
    "You": "Bạn",
    "Uploading...": "Đang tải lên...",
    "Failed": "Thất bại",
    "Settings": "Cài đặt",
    "Log out": "Đăng xuất"
  }
};

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState(localStorage.getItem("lang") || "EN");

  useEffect(() => {
    localStorage.setItem("lang", lang);
  }, [lang]);

  const t = (key) => {
    return translations[lang]?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
