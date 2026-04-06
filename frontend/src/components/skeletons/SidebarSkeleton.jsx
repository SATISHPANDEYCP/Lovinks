import { Users } from "lucide-react";

const SidebarSkeleton = () => {
  const skeletonContacts = Array.from({ length: 7 });

  return (
    <aside className="h-full w-full sm:w-80 lg:w-72 border-r border-base-300 flex flex-col transition-all duration-200 text-base-content">
      {/* Header */}
      <div className="border-b border-base-300 w-full px-4 py-3 sm:p-5">
        <div className="flex items-center gap-2">
          <Users className="size-5 sm:size-6" />
          <span className="font-medium">Contacts</span>
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <span className="skeleton h-4 w-4 rounded-sm" />
          <span className="skeleton h-3 w-24 rounded-md" />
          <span className="skeleton h-3 w-14 rounded-md" />
        </div>
      </div>

      {/* Skeleton Contacts */}
      <div className="overflow-y-auto w-full py-2">
        {skeletonContacts.map((_, idx) => (
          <div key={idx} className="w-full px-4 py-3 flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <div
                className="skeleton size-12 rounded-full"
                style={{ animationDelay: `${idx * 70}ms` }}
              />
            </div>

            <div className="text-left min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div
                  className="skeleton h-4 w-28 sm:w-32 rounded-md"
                  style={{ animationDelay: `${idx * 70 + 40}ms` }}
                />
                <div
                  className="skeleton h-3 w-9 rounded-md"
                  style={{ animationDelay: `${idx * 70 + 80}ms` }}
                />
              </div>
              <div
                className="skeleton h-3 w-20 sm:w-24 rounded-md"
                style={{ animationDelay: `${idx * 70 + 120}ms` }}
              />
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};

export default SidebarSkeleton;
