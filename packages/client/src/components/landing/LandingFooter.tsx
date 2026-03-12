export function LandingFooter() {
   return (
      <footer className="border-t border-border/60 bg-gradient-to-b from-muted/40 to-background">
         <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <p>
               © {new Date().getFullYear()} Fullstack AI Angler. Designed for
               modern outdoor products.
            </p>
            <div className="flex items-center gap-4">
               <a href="#" className="transition-colors hover:text-foreground">
                  Privacy
               </a>
               <a href="#" className="transition-colors hover:text-foreground">
                  Terms
               </a>
               <a
                  href="#faq"
                  className="transition-colors hover:text-foreground"
               >
                  Contact
               </a>
            </div>
         </div>
      </footer>
   );
}
