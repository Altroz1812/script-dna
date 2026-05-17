{
  /* Quick Context Indicator - add at top of dashboard */
}
<div className="fixed bottom-4 right-4 z-50">
  <div className="bg-black/80 backdrop-blur-md rounded-full px-4 py-2 text-xs border border-white/20 shadow-lg">
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full bg-green-500" />
      <span className="text-muted-foreground">Role:</span>
      <span className="font-medium text-foreground">{role}</span>
      {organizationId && !isStudent && !isParent && (
        <>
          <span className="text-muted-foreground">| Org:</span>
          <span className="font-medium text-primary">{orgName || organizationId.slice(0, 8)}</span>
        </>
      )}
    </div>
  </div>
</div>;
