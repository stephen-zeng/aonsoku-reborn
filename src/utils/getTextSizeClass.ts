export function getTextSizeClass(text: string) {
  const base = (value: string) => `${value} text-balance align-baseline`;

  if (text.length < 15) {
    return base(
      "md:text-6xl 2xl:text-7xl md:leading-[4.75rem] 2xl:leading-[5.625rem]",
    );
  }

  if (text.length > 40) {
    return base(
      "md:text-3xl 2xl:text-5xl md:leading-[2.65rem] 2xl:leading-[4rem]",
    );
  }

  return base("md:text-4xl 2xl:text-6xl md:leading-[3rem] 2xl:leading-[5rem]");
}
