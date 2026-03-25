/**
 * Logo Natville (ficheiro em /public/logonatville.webp)
 */
export default function AppLogo({ className = '', imgClassName = 'h-12 w-auto' }) {
  return (
    <div className={`flex justify-center ${className}`}>
      <img
        src="/logonatville.webp"
        alt="Natville"
        className={imgClassName}
        width={180}
        height={48}
        decoding="async"
      />
    </div>
  )
}
