const TypingIndicator = () => {
   return (
      <div className="flex gap-1 self-start bg-gray-200 px-3 py-3 rounded-md">
         <Dot />
         <Dot className="[animation-delay: 0.2]" />
         <Dot className="[animation-delay: 0.4]" />
      </div>
   );
};

type DotProps = {
   className?: string;
};
const Dot = ({ className }: DotProps) => (
   <div
      className={`w-2 h-2 bg-gray-800 rounded-full animate-pulse ${className || ''}`}
   />
);
export default TypingIndicator;
