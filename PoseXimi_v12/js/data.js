/** Static options and demo-only presets. Replace ranking with your backend. */
export const STYLES = [
  { id: 'Casual', label: 'Casual', desc: 'Tự nhiên, thoải mái', symbol: '♡' },
  { id: 'Fashion', label: 'Fashion', desc: 'Thời trang, cá tính', symbol: '✦' },
  { id: 'JoJo', label: 'JoJo', desc: 'Dáng pose mạnh mẽ, nổi bật', symbol: '★' }
];
export const BACKGROUNDS = [
  { id: 'studio', label: 'Trong nhà', swatch: 'studio' },
  { id: 'pastel', label: 'Màu trơn', swatch: 'pastel' },
  { id: 'city', label: 'Vintage', swatch: 'city' },
  { id: 'nature', label: 'Ngoài trời', swatch: 'nature' }
];
export const POSE_PRESETS = {
  solo: [
    ['solo-walk', 'Bước đi nhẹ nhàng', 'Chuyển động tự nhiên, tự tin.', 0],
    ['solo-lean', 'Nghiêng vai', 'Một chút nghiêng, một chút chất.', 1],
    ['solo-peace', 'Năng lượng tích cực', 'Giơ tay và mỉm cười thật tươi.', 2],
    ['solo-classic', 'Dáng đứng cổ điển', 'Đơn giản mà vẫn nổi bật.', 3],
    ['solo-fashion', 'Tay trong túi', 'Phù hợp với ảnh thời trang.', 4],
    ['solo-wave', 'Vẫy tay chào', 'Một khoảnh khắc thật gần gũi.', 5]
  ],
  duo: [
    ['duo-side', 'Tựa vai nhau', 'Ấm áp và gần gũi.', 0],
    ['duo-highfive', 'High-five!', 'Năng lượng đồng điệu, vui nhộn.', 1],
    ['duo-mirror', 'Đối xứng', 'Cặp đôi cá tính, đồng điệu.', 2],
    ['duo-walk', 'Cùng bước đi', 'Tự nhiên như một thước phim.', 3],
    ['duo-heart', 'Trái tim bạn bè', 'Đáng yêu và đầy cảm xúc.', 4],
    ['duo-back', 'Tựa lưng', 'Đậm chất ảnh kỷ niệm.', 5]
  ],
  trio: [
    ['trio-triangle', 'Bộ ba ăn ý', 'Bố cục cân đối cho ba người.', 0],
    ['trio-wave', 'Hello besties', 'Đầy màu sắc và năng lượng.', 1],
    ['trio-walk', 'Cùng nhau sải bước', 'Ghi lại phút giây tự nhiên.', 2],
    ['trio-line', 'Đứng so le', 'Nhẹ nhàng mà đẹp khung hình.', 3],
    ['trio-classic', 'Ba phong cách', 'Mỗi người một cá tính.', 4],
    ['trio-party', 'Bùng nổ niềm vui', 'Dành cho hội bạn thân.', 5]
  ],
  group: [
    ['group-line', 'Đội hình đồng điệu', 'Mọi người cùng nổi bật.', 0],
    ['group-cheer', 'Cùng giơ tay', 'Lưu lại nguồn năng lượng vui vẻ.', 1],
    ['group-arc', 'Vòng cung', 'Đội hình tự nhiên, hài hòa.', 2],
    ['group-stagger', 'Đứng so le', 'Ảnh nhóm sinh động, cân đối.', 3],
    ['group-walk', 'Hội bạn dạo phố', 'Khung hình tràn đầy sức sống.', 4],
    ['group-creative', 'Tạo dáng tự do', 'Mỗi người một tư thế độc đáo.', 5]
  ]
};
