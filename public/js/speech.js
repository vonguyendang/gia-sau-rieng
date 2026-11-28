/**
 * public/js/speech.js
 * Đọc bảng giá sầu riêng hôm nay bằng giọng nói tiếng Việt tự nhiên (Web Speech API).
 * Chạy 100% offline ngay trên trình duyệt (0đ, không cần gọi API Cloud TTS bên thứ ba).
 */

const AVAILABLE_SPEECH_RATES = [1.0, 1.25, 1.5, 1.75];
let currentSpeechRate = parseFloat(localStorage.getItem('durian_speech_rate')) || 1.25;
let isSpeaking = false;
let currentUtterance = null;

function toggleSpeechPlayback() {
  if (!('speechSynthesis' in window)) {
    alert('Trình duyệt của bạn chưa hỗ trợ tính năng đọc giọng nói Web Speech.');
    return;
  }

  const synth = window.speechSynthesis;

  if (isSpeaking) {
    synth.cancel();
    setSpeakingState(false);
    return;
  }

  const textToRead = generateSpeechScript();
  if (!textToRead) {
    alert('Dữ liệu giá chưa sẵn sàng để đọc.');
    return;
  }

  synth.cancel(); // Dừng các âm thanh cũ nếu có

  const utterance = new SpeechSynthesisUtterance(textToRead);
  currentUtterance = utterance;

  // Cấu hình ngôn ngữ tiếng Việt & Tốc độ đọc
  utterance.lang = 'vi-VN';
  utterance.rate = currentSpeechRate; // Mặc định 1.25x nhanh, dứt khoát
  utterance.pitch = 1.0;

  // Tìm giọng tiếng Việt tối ưu có sẵn trên thiết bị (iOS, Android, Windows, Mac)
  const voices = synth.getVoices();
  const viVoice = voices.find(v => v.lang && (v.lang.includes('vi') || v.lang.includes('VN')));
  if (viVoice) {
    utterance.voice = viVoice;
  }

  utterance.onstart = () => {
    setSpeakingState(true);
  };

  utterance.onend = () => {
    setSpeakingState(false);
  };

  utterance.onerror = (e) => {
    console.warn('Lỗi đọc giọng nói:', e);
    setSpeakingState(false);
  };

  synth.speak(utterance);
}

function cycleSpeechSpeed() {
  const currentIndex = AVAILABLE_SPEECH_RATES.indexOf(currentSpeechRate);
  const nextIndex = currentIndex === -1 ? 1 : (currentIndex + 1) % AVAILABLE_SPEECH_RATES.length;
  currentSpeechRate = AVAILABLE_SPEECH_RATES[nextIndex];
  localStorage.setItem('durian_speech_rate', currentSpeechRate);
  updateSpeedButtonUI();

  // Nếu đang đọc thì áp dụng tốc độ mới ngay lập tức
  if (isSpeaking && window.speechSynthesis) {
    window.speechSynthesis.cancel();
    isSpeaking = false;
    toggleSpeechPlayback();
  }
}

function updateSpeedButtonUI() {
  const speedBtn = document.getElementById('btn-speech-speed');
  if (speedBtn) {
    speedBtn.textContent = `${currentSpeechRate}x`;
    speedBtn.title = `Tốc độ đọc: ${currentSpeechRate}x (Bấm để đổi 1.0x, 1.25x, 1.5x, 1.75x)`;
  }
}

function setSpeakingState(speaking) {
  isSpeaking = speaking;
  const btn = document.getElementById('btn-speech-toggle');
  const icon = document.getElementById('speech-icon');
  const textSpan = document.getElementById('speech-text');

  if (!btn) return;

  if (speaking) {
    btn.classList.add('bg-amber-400', 'text-emerald-950');
    btn.classList.remove('text-slate-700', 'dark:text-slate-200');
    if (icon) {
      icon.className = 'fa-solid fa-volume-high text-xs text-emerald-950 animate-pulse';
    }
    if (textSpan) textSpan.textContent = 'Đang phát... (Bấm dừng)';
  } else {
    btn.classList.remove('bg-amber-400', 'text-emerald-950');
    btn.classList.add('text-slate-700', 'dark:text-slate-200');
    if (icon) {
      icon.className = 'fa-solid fa-volume-high text-xs text-emerald-600 dark:text-emerald-400';
    }
    if (textSpan) textSpan.textContent = 'Nghe Báo Giá';
  }
}

function generateSpeechScript() {
  if (!historyData || !historyData.days) return '';

  const daysKeys = historyData.available_days || Object.keys(historyData.days).sort().reverse();
  const activeDay = currentSelectedDay || daysKeys[0];
  const dayData = historyData.days[activeDay];
  if (!dayData) return '';

  let prices = dayData.daily_average || {};
  let regName = 'toàn quốc';
  if (currentRegion !== 'all' && dayData.by_region && dayData.by_region[currentRegion]) {
    prices = dayData.by_region[currentRegion];
    const regNames = {
      mientay: 'miền Tây',
      miendong: 'miền Đông',
      taynguyen: 'Tây Nguyên'
    };
    regName = regNames[currentRegion] || currentRegion;
  }

  const parts = activeDay.split('-');
  const d = parseInt(parts[2], 10);
  const m = parseInt(parts[1], 10);

  // Kịch bản đọc gãy gọn, dứt khoát, trực diện vào giá, không lặp từ rườm rà
  let script = `Giá sầu riêng ngày ${d} tháng ${m}, khu vực ${regName}. `;

  if (prices.ri6_a && prices.ri6_b) {
    script += `Ri Sáu loại A: ${formatSpeechNumber(prices.ri6_a)}, loại B: ${formatSpeechNumber(prices.ri6_b)}. `;
  } else if (prices.ri6_a) {
    script += `Ri Sáu loại A: ${formatSpeechNumber(prices.ri6_a)}. `;
  }

  if (prices.monthong_a && prices.monthong_b) {
    script += `Thái Mỏn Thong loại A: ${formatSpeechNumber(prices.monthong_a)}, loại B: ${formatSpeechNumber(prices.monthong_b)}. `;
  } else if (prices.monthong_a) {
    script += `Thái loại A: ${formatSpeechNumber(prices.monthong_a)}. `;
  }

  if (prices.musang_king) {
    script += `Musang King: ${formatSpeechNumber(prices.musang_king)}. `;
  }
  if (prices.black_thorn) {
    script += `Black Thorn: ${formatSpeechNumber(prices.black_thorn)}. `;
  }
  if (prices.chuong_bo) {
    script += `Chuồng bò: ${formatSpeechNumber(prices.chuong_bo)}. `;
  }

  script += `Giá tham khảo cắt xô tại vườn. Chúc bà con giao dịch thuận lợi!`;
  return script;
}

function formatSpeechNumber(num) {
  if (!num) return 'không';
  // Đọc số tự nhiên cho máy đọc: ví dụ 60000 -> 60 nghìn
  if (num >= 1000) {
    const thousands = Math.round(num / 1000);
    return `${thousands} nghìn`;
  }
  return num.toString();
}

// Khởi tạo tốc độ ban đầu & Voice list khi nạp trang
document.addEventListener('DOMContentLoaded', () => {
  updateSpeedButtonUI();
});

if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}
