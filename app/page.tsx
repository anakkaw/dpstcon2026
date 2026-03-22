import Link from "next/link";
import { FileText, Users, ClipboardCheck, BarChart3 } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Decorative blobs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-brand-500/20 via-brand-600/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-40 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Hero Section */}
      <div className="relative max-w-4xl mx-auto px-6 pt-28 pb-24 text-center">
        <div className="inline-flex h-16 w-16 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 items-center justify-center mb-8 shadow-2xl shadow-brand-500/40">
          <span className="text-white font-bold text-3xl">D</span>
        </div>
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight mb-4">
          DPSTCon
        </h1>
        <p className="text-xl text-slate-300 max-w-xl mx-auto mb-2">
          ระบบบริหารการพิจารณาบทความสำหรับการประชุมวิชาการ
        </p>
        <p className="text-sm text-slate-500 mb-10">
          Conference Paper Management System
        </p>

        <Link
          href="/login"
          className="inline-flex items-center px-8 py-4 rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 text-white font-bold text-base hover:from-brand-600 hover:to-brand-700 transition-all duration-300 shadow-xl shadow-brand-500/30 hover:shadow-2xl hover:shadow-brand-500/40 hover:-translate-y-1 active:translate-y-0"
        >
          เข้าสู่ระบบ
        </Link>
      </div>

      {/* Features */}
      <div className="relative max-w-5xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              icon: <FileText className="h-7 w-7" />,
              title: "ส่งบทความ",
              desc: "ส่งและติดตามสถานะบทความได้ง่าย",
              gradient: "bg-feat-orange",
            },
            {
              icon: <ClipboardCheck className="h-7 w-7" />,
              title: "รีวิวบทความ",
              desc: "ระบบรีวิว 5 มิติพร้อมคำแนะนำ",
              gradient: "bg-feat-blue",
            },
            {
              icon: <Users className="h-7 w-7" />,
              title: "จัดการทีม",
              desc: "มอบหมายงานและติดตามความคืบหน้า",
              gradient: "bg-feat-green",
            },
            {
              icon: <BarChart3 className="h-7 w-7" />,
              title: "วิเคราะห์ข้อมูล",
              desc: "แดชบอร์ดสรุปผลตาม role",
              gradient: "bg-feat-violet",
            },
          ].map((feat) => (
            <div
              key={feat.title}
              className="group bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6 hover:bg-slate-800/80 hover:border-slate-600/50 hover:-translate-y-1 transition-all duration-300"
            >
              <div className={`h-12 w-12 rounded-xl ${feat.gradient} flex items-center justify-center text-white mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                {feat.icon}
              </div>
              <h3 className="font-bold text-white mb-1.5">{feat.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="relative border-t border-slate-800 py-6 text-center text-sm text-slate-500">
        DPSTCon Conference Management System &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
