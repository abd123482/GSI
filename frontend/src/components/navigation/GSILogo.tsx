import React from 'react';

export function GSILogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1150 600"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Grey swoosh — behind the G */}
      <path
        d="
          M 117 554
          C 170 520 225 486 296 447
          C 342 421 385 389 414 351
          C 432 328 441 307 431 295
          C 420 282 378 275 290 272

          C 352 245 415 226 458 232
          C 500 238 519 264 512 291
          C 505 322 481 354 449 385
          C 412 421 368 448 320 474
          C 244 516 179 544 117 558
          Z
        "
        fill="#e5ff00ff"
      />

      {/* Custom G shape traced from reference */}
      <path
        d="
          M 485 81

          C 472 73 430 70 383 74
          C 310 80 244 96 190 126
          C 135 156 100 198 89 249

          C 78 300 91 349 123 391
          C 157 435 212 462 272 475
          C 330 487 400 484 461 479

          C 472 478 479 471 479 460
          C 479 449 472 442 461 441

          C 403 441 351 431 310 412
          C 270 394 243 371 228 340
          C 215 313 210 278 215 250

          C 220 219 233 195 255 175
          C 283 148 319 131 359 119
          C 400 107 443 104 480 106

          C 488 106 492 101 491 93
          C 491 87 489 83 485 81
          Z
        "
        fill="#ffffffff"
      />

      {/* SI */}
      <text
        x="515"
        y="470"
        fontFamily="Arial Black, Impact, system-ui, sans-serif"
        fontWeight="900"
        fontStyle="italic"
        fontSize="480"
        fill="#ffffffff"
        letterSpacing="-10"
      >
        SI
      </text>
    </svg>
  );
}