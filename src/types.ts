export interface AestheticColor {
  name: string;
  hex: string;
}

export const NICHE_COLORS: AestheticColor[] = [
  { name: "赤陶色", hex: "#E2725B" },
  { name: "鼠尾草绿", hex: "#B2AC88" },
  { name: "灰粉色", hex: "#DCAE96" },
  { name: "午夜蓝", hex: "#191970" },
  { name: "赭石色", hex: "#CC7722" },
  { name: "淡紫色", hex: "#E0B0FF" },
  { name: "青瓷色", hex: "#ACE1AF" },
  { name: "石板灰", hex: "#708090" },
  { name: "杏黄色", hex: "#FBCEB1" },
  { name: "长春花蓝", hex: "#CCCCFF" },
  { name: "橄榄褐", hex: "#5A5A40" },
  { name: "赭褐色", hex: "#A0522D" },
  { name: "海泡绿", hex: "#8FBC8F" },
  { name: "薰衣草紫", hex: "#E6E6FA" },
  { name: "珊瑚色", hex: "#FF7F50" },
  { name: "蓝绿色", hex: "#008080" },
  { name: "芥末黄", hex: "#E1AD01" },
  { name: "炭灰色", hex: "#36454F" },
  { name: "靛蓝色", hex: "#4B0082" },
  { name: "薄荷绿", hex: "#F5FFFA" },
  { name: "莫兰迪灰", hex: "#95a5a6" },
  { name: "奶茶色", hex: "#d2b48c" },
  { name: "雾霾蓝", hex: "#778899" },
  { name: "牛油果绿", hex: "#556b2f" },
  { name: "香槟金", hex: "#f7e7ce" },
  { name: "樱花粉", hex: "#FFB7C5" },
  { name: "孔雀蓝", hex: "#004E7C" },
  { name: "象牙白", hex: "#FFFFF0" },
  { name: "松石绿", hex: "#40E0D0" },
  { name: "琥珀色", hex: "#FFBF00" },
  { name: "波尔多红", hex: "#6D0E11" },
  { name: "卡其色", hex: "#C3B091" },
  { name: "薄荷蓝", hex: "#A2D2E2" },
  { name: "丁香紫", hex: "#C8A2C8" },
  { name: "珊瑚粉", hex: "#F88379" },
  { name: "翡翠绿", hex: "#50C878" },
  { name: "藏青色", hex: "#000080" },
  { name: "焦糖色", hex: "#AF6F09" },
  { name: "浅艾蓝", hex: "#87CEEB" },
  { name: "玫瑰金", hex: "#B76E79" },
  { name: "抹茶绿", hex: "#8FB066" },
  { name: "提香红", hex: "#B05923" },
  { name: "普鲁士蓝", hex: "#003153" },
  { name: "奶油色", hex: "#FFFDD0" },
  { name: "灰湖绿", hex: "#7F9F9F" },
  { name: "藕粉色", hex: "#EDC9AF" },
  { name: "黛蓝色", hex: "#1A237E" },
  { name: "秋葵绿", hex: "#6B8E23" },
  { name: "古铜色", hex: "#CD7F32" },
  { name: "月光白", hex: "#F5F5F5" },
  { name: "极光紫", hex: "#4B0082" },
  { name: "枫叶红", hex: "#C04000" },
  { name: "深海蓝", hex: "#00008B" },
  { name: "柠檬黄", hex: "#FFF700" },
  { name: "橄榄绿", hex: "#808000" },
  { name: "浅紫罗兰", hex: "#CF9FFF" },
  { name: "珊瑚橘", hex: "#FF6F61" },
  { name: "墨绿色", hex: "#006400" },
  { name: "天蓝色", hex: "#87CEEB" },
  { name: "香芋紫", hex: "#D1BBFF" },
  { name: "薄荷青", hex: "#D0F0C0" },
  { name: "砖红色", hex: "#CB4154" },
  { name: "孔雀绿", hex: "#00A86B" },
  { name: "浅驼色", hex: "#C19A6B" },
  { name: "烟粉色", hex: "#D1A7A7" }
];

export interface DailyGridData {
  id?: string;
  userId: string;
  date: string; // YYYY-MM-DD
  color: AestheticColor;
  images: string[]; // Base64 strings
  extractedColors?: AestheticColor[];
}
