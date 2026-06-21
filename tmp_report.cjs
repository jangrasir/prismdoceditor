const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, 
        Header, Footer, PageNumber, LevelFormat } = require('docx');
const fs = require('fs');

function p(text, opts = {}) {
  return new Paragraph({
    alignment: opts.align || AlignmentType.JUSTIFIED,
    spacing: { after: 200, line: 360 },
    children: [new TextRun({ text, size: 24, font: "Arial" })]
  });
}

function h(level, text) {
  return new Paragraph({
    heading: level === 1 ? HeadingLevel.HEADING_1 : (level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3),
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text, bold: true, size: (level === 1 ? 36 : level === 2 ? 30 : 26), font: "Arial" })]
  });
}

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 24 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial" },
        paragraph: { spacing: { before: 400, after: 240 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, font: "Arial" },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial" },
        paragraph: { spacing: { before: 300, after: 160 }, outlineLevel: 2 } }
    ]
  },
  numbering: {
    config: [
      { reference: "bullets",
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } }
        ] },
      { reference: "numbers",
        levels: [
          { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } }
        ] }
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "PrismDocEditor - Project Report", size: 20, font: "Arial", italics: true, color: "666666" })]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Page ", size: 20, font: "Arial" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 20, font: "Arial" })
          ]
        })]
      })
    },
    children: [
      // Title
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 2400, after: 400 },
        children: [new TextRun({ text: "PrismDocEditor", bold: true, size: 56, font: "Arial" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 800 },
        children: [new TextRun({ text: "A Browser-Based Multifunctional Document, Image & Audio Processing Platform", size: 28, font: "Arial" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 2400 },
        children: [new TextRun({ text: "Detailed Project Report with Role & Responsibilities", size: 28, font: "Arial", italics: true })]
      }),

      // Executive Summary
      h(1, "Executive Summary"),
      p("PrismDocEditor is a modern, browser-based productivity platform designed to empower users with comprehensive document, image, and audio processing capabilities without requiring any external desktop software. The application provides a unified interface where users can manipulate PDF documents, edit images, and process audio files entirely within the web browser. Built with a strong emphasis on privacy, performance, and user experience, PrismDocEditor ensures that sensitive files are processed locally on the client side whenever possible, reducing dependency on server-side processing and minimizing data exposure. The platform targets students, professionals, content creators, legal teams, and anyone who regularly works with digital media and needs quick, reliable, and secure file transformations."),
      p("The project stands out from conventional online file converters because it does not require users to upload their files to a remote server for most operations. This local-first approach is particularly valuable for users who handle confidential documents, personal photographs, or proprietary audio recordings. By keeping the processing within the browser, PrismDocEditor minimizes the risk of data interception, unauthorized access, and retention in third-party systems. The application only communicates with the cloud when users explicitly choose to authenticate or save results to their personal library."),
      p("My role in this project spanned across frontend development, feature implementation, security hardening, database design discussions, and frontend-backend integration. I was actively involved in building and refining the PDF processing suite, particularly the encryption subsystem, where I implemented advanced permission controls, owner-user password separation logic, and post-encryption verification to ensure files were genuinely protected. I also contributed to the overall user experience by helping shape the feature set, debugging cross-cutting issues, and making pragmatic decisions such as removing features that did not meet quality standards. This report provides an in-depth account of the project, its architecture, features, challenges, and my specific contributions."),

      // Introduction
      h(1, "Introduction"),
      p("In today\u2019s digital-first environment, the ability to manipulate documents, images, and audio files quickly and securely has become essential for both personal and professional workflows. Traditional desktop software for these tasks is often expensive, bloated with unnecessary features, and requires installation across multiple devices. Cloud-based alternatives, while convenient, frequently raise concerns about data privacy because files must be uploaded to remote servers for processing. PrismDocEditor was conceived to bridge this gap by offering a lightweight, browser-native alternative that performs the majority of operations locally on the user\u2019s device."),
      p("The application is structured around three primary tool categories: PDF Tools, Image Tools, and Audio Tools. Each category contains a rich set of functionalities tailored to common use cases. PDF Tools include merging, splitting, reordering, compressing, watermarking, optical character recognition, header and footer management, redaction, digital signing, thumbnail generation, and page editing. Image Tools provide compression, resizing, rotation, format conversion, and image-to-PDF conversion. Audio Tools allow users to trim, merge, adjust volume, apply fades, and normalize audio clips. This breadth of functionality positions PrismDocEditor as a versatile digital utility rather than a single-purpose tool."),
      p("The development philosophy behind PrismDocEditor prioritizes three core principles: privacy by design, performance through client-side processing, and consistency through a cohesive user interface. Privacy is achieved by processing files in the browser using JavaScript APIs and libraries, which means files do not leave the user\u2019s device unless the user explicitly chooses to save them to their cloud library. Performance is enhanced by avoiding server round-trips for computational tasks and by using modern React patterns such as memoization, lazy loading, and asynchronous non-blocking operations. Consistency is maintained through a custom design system built on Tailwind CSS and shadcn/ui, ensuring that every interaction feels polished and professional."),
      p("Throughout the project lifecycle, my involvement was deeply technical and hands-on. I worked on implementing features, resolving security issues, optimizing workflows, and collaborating on architectural decisions. The following sections describe the project in comprehensive detail, including its objectives, technology stack, feature modules, architecture, and the specific contributions I made as a developer."),

      // Problem Statement
      h(1, "Problem Statement and Motivation"),
      p("Modern users face a fragmented landscape when it comes to file processing tools. A typical workflow might involve opening one application to merge PDFs, another to compress an image, a third to trim an audio clip, and yet another to password-protect a document. This fragmentation leads to several problems: wasted time switching between tools, inconsistent user experiences, increased subscription costs, and heightened security risks from uploading sensitive files to multiple third-party services."),
      p("Furthermore, many existing solutions lack robust privacy controls. When a user uploads a confidential contract, medical record, or personal photograph to an online converter, they lose control over where that file is stored, how long it is retained, and who may access it. Data breaches and opaque privacy policies exacerbate these concerns. There is a clear need for a unified platform that performs common file operations locally, stores outputs only at the user\u2019s explicit request, and provides transparent, user-friendly security features."),
      p("PrismDocEditor was motivated by the desire to solve these problems through a single, cohesive web application. By leveraging the advanced capabilities of modern browsers, including the File API, Canvas API, Web Audio API, and powerful JavaScript libraries, the platform can handle complex file transformations without server-side intervention. This approach not only improves privacy but also reduces latency, since files do not need to travel across the network for processing."),
      p("Additionally, the project aimed to demonstrate how a well-architected React application could integrate with cloud services for authentication, metadata storage, and optional cloud library features, while still keeping the core processing logic on the client. This hybrid model provides the best of both worlds: the convenience of cloud-based user accounts and history, combined with the privacy and speed of local file manipulation."),

      // Objectives
      h(1, "Project Objectives"),
      p("The primary objective of PrismDocEditor was to build a reliable, secure, and intuitive browser-based platform for processing PDFs, images, and audio files. This overarching goal was broken down into several concrete objectives that guided the development process and shaped the final product."),
      p("The first objective was to provide a comprehensive suite of file processing tools within a single application. Rather than building separate tools for each operation, the project sought to unify PDF, image, and audio workflows under one roof, allowing users to move seamlessly between different types of tasks. The second objective was to ensure that the majority of processing happens locally in the browser. This protects user privacy, reduces server load, and enables faster operations by eliminating network latency."),
      p("The third objective was to implement secure user authentication and optional cloud storage. By integrating with Supabase, the application provides email-based authentication, profile management, and a personal library where users can store processed files if they choose. The fourth objective was to maintain a high-quality user interface that feels modern and accessible. This was achieved through the shadcn/ui component library, Tailwind CSS styling, responsive layouts, and thoughtful interaction design."),
      p("The fifth objective was to implement robust security features, particularly for sensitive operations such as PDF encryption. This involved not only password-protecting documents but also enforcing granular permissions for printing, copying, and modification. The sixth objective was to ensure code quality through TypeScript, ESLint, automated testing with Vitest, and clear component boundaries. Finally, the project aimed to be easily deployable and maintainable, using Vite for fast builds and a clean component-based architecture."),

      // Technology Stack
      h(1, "Technology Stack and Architecture"),
      h(2, "Frontend Technologies"),
      p("The frontend of PrismDocEditor is built using React 18, one of the most widely adopted JavaScript libraries for building user interfaces. React\u2019s component-based model and virtual DOM enable the creation of dynamic, responsive, and maintainable UIs. The project uses functional components throughout, combined with hooks such as useState, useEffect, useCallback, useMemo, and useRef to manage state, side effects, and performance optimizations."),
      p("TypeScript is used as the primary language, providing static type checking that catches errors at compile time and improves developer productivity. TypeScript interfaces and types are defined for component props, API responses, file metadata, and application state, ensuring consistency across the codebase. Vite serves as the build tool and development server, offering extremely fast hot module replacement, optimized production builds, and a modern plugin ecosystem."),
      p("Styling is handled by Tailwind CSS, a utility-first CSS framework that enables rapid UI development while maintaining design consistency. The project also uses shadcn/ui, a collection of reusable, accessible UI components built on top of Radix UI primitives. This combination provides a polished design system with components such as buttons, cards, tabs, dialogs, sliders, switches, and dropdowns that follow accessibility best practices."),
      p("For icons, the application uses Lucide React, a clean and consistent icon library. For toast notifications and user feedback, it uses Sonner, a lightweight and customizable toast library. Date formatting is handled by date-fns, and form management is supported by React Hook Form with Zod for schema validation. Client-side routing is managed by React Router, enabling navigation between landing page, authentication, dashboard, tools, profile, and history pages."),
      h(2, "Backend and Cloud Services"),
      p("Although the core file processing logic runs in the browser, PrismDocEditor relies on Lovable Cloud with Supabase for backend services. Supabase provides authentication, a Postgres database, and object storage. Authentication supports email-based sign-in and profile management. The user profile stores information such as full name and avatar URL, while a separate user roles system ensures proper authorization if administrative features are needed."),
      p("The Postgres database is used to store metadata about processed files, including file name, type, action performed, and details of the operation. This enables the history or library feature, where users can review their past activities. Supabase Storage is used to store output files when users choose to save them to their library. Row-Level Security policies are implemented to ensure that users can only access their own data, following the principle of least privilege."),
      p("The architecture is intentionally decoupled. The frontend handles computation and UI, while the backend handles identity, persistence, and storage. This separation allows the application to function as a privacy-first local tool for anonymous users, while offering enhanced convenience for authenticated users who want cloud storage."),
      h(2, "File Processing Libraries"),
      p("For PDF manipulation, the project uses pdf-lib and its fork @cantoo/pdf-lib. These libraries allow loading, editing, merging, splitting, reordering, watermarking, redacting, signing, and encrypting PDF documents entirely in the browser. They support embedding images, drawing text, managing pages, and applying security settings."),
      p("For image processing, the application leverages the HTML5 Canvas API for resizing, rotation, and format conversion, while browser-image-compression handles advanced compression with web worker support. For OCR, tesseract.js provides text extraction from scanned PDFs and images. The JSZip library is used when packaging multiple output files into a single downloadable archive."),
      p("For audio processing, the project uses the native Web Audio API. Custom utility functions decode audio files into AudioBuffer objects, perform trimming, merging, gain adjustment, fade in/out, and peak normalization, and convert the results back into WAV format for download. This approach avoids external dependencies and keeps audio processing fully local."),

      // System Modules
      h(1, "System Modules and Features"),
      h(2, "PDF Tools Module"),
      p("The PDF Tools module is the most feature-rich component of PrismDocEditor. It provides a drag-and-drop interface for uploading PDF files and offers multiple operations through a tabbed navigation system. The Merge tool allows users to combine multiple PDFs into a single document in the order they were uploaded. The Split tool enables extraction of specific pages using comma-separated ranges. The Reorder tool lets users rearrange pages visually with up and down controls."),
      p("The Compress tool reduces file size by optimizing images and removing redundant data within the PDF structure. The To Images tool converts each page of a PDF into raster image formats, which is useful for previews, sharing, or embedding content in presentations. The Watermark tool adds text or image overlays to every page, supporting both visible and configurable watermark settings. The OCR tool extracts machine-readable text from scanned documents using tesseract.js, making scanned PDFs searchable and copyable."),
      p("Additional capabilities include the Header and Footer tool for adding consistent page branding, the Redact tool for permanently removing sensitive regions, the Sign tool for overlaying digital signatures, the Thumbnails tool for generating page preview images, and the Edit tool for general page-level modifications. Each tool is implemented as a separate component that receives the uploaded files as props, keeping the main PDF page clean and maintainable."),
      h(2, "Image Tools Module"),
      p("The Image Tools module supports compression, resizing, rotation, format conversion, and image-to-PDF conversion. Users upload an image through a dropzone, preview it in real time, and apply transformations. Compression uses the browser-image-compression library with adjustable quality. Resizing and rotation use the Canvas API. Format conversion supports PNG and JPEG outputs. The image-to-PDF tool embeds the image into a single-page PDF document using pdf-lib."),
      h(2, "Audio Tools Module"),
      p("The Audio Tools module allows users to trim audio clips by specifying start and end times, merge multiple clips into a single WAV file, and apply volume adjustments, fade effects, and normalization. Audio files are decoded using the Web Audio API, processed through a pipeline of buffer transformations, and exported as WAV files using a custom audioBufferToWav utility. The module includes track playback controls so users can preview clips before processing."),
      h(2, "User Account and Library Module"),
      p("The user account system is built around Supabase authentication and a React context provider. Users can sign up, sign in, manage their profile, upload avatars, and view their processing history. The library or history feature stores metadata about each operation and optionally stores the output file in Supabase Storage. This allows authenticated users to download previously processed files without re-running the operation."),

      // Code Organization
      h(1, "Code Organization and Component Architecture"),
      p("The codebase of PrismDocEditor follows a clear and scalable directory structure that separates concerns and promotes reusability. The src directory contains the main application code, organized into subdirectories for components, pages, hooks, contexts, lib, and integrations. This structure makes it easy for developers to locate specific functionality and ensures that components remain focused and testable."),
      p("The pages directory contains top-level route components such as Landing, Auth, Dashboard, PdfTools, ImageTools, AudioTools, Profile, and HistoryPage. Each page component orchestrates the layout and state for its respective route. The components directory contains reusable UI components, including the shadcn/ui primitives under src/components/ui and feature-specific components such as the PDF tool panels under src/components/pdf."),
      p("Shared business logic lives in the lib directory. Files such as files.ts, audio.ts, pdfRenderer.ts, and ocrWorker.ts encapsulate complex operations and provide clean APIs for pages and components to consume. Custom hooks such as use-mobile.tsx and use-toast.ts provide reusable behavior across the application. The contexts directory contains providers such as AuthContext that manage global state for authentication."),
      p("The integrations directory contains the auto-generated Supabase client and TypeScript types. This separation ensures that backend communication is centralized and that type safety extends from the database schema through to the UI components. I contributed to maintaining this organization by keeping feature-specific logic in dedicated files, using TypeScript types consistently, and avoiding unnecessary coupling between components."),

      // My Role
      h(1, "My Role and Responsibilities"),
      p("As a frontend developer on the PrismDocEditor project, my responsibilities covered a broad spectrum of technical and collaborative activities. I was involved in writing and reviewing code, debugging complex issues, making architectural decisions, and ensuring that the features I worked on met high standards of quality, security, and usability."),
      p("My primary focus was on the PDF processing tools, where I implemented features, fixed bugs, and hardened security logic. I worked extensively with the pdf-lib library to manipulate PDF documents, add watermarks, apply encryption, and verify that security settings were correctly applied. I also contributed to discussions about database schema design, user roles, Row-Level Security policies, and frontend-backend communication patterns."),
      p("Beyond feature development, I took ownership of debugging and troubleshooting. When features did not behave as expected, I investigated root causes, tested hypotheses, and implemented targeted fixes. I was also responsible for making pragmatic decisions about feature scope, such as recognizing when a feature could not be made sufficiently reliable and recommending its removal from the user interface."),
      p("I collaborated closely with the rest of the development team, sharing knowledge about browser-based file processing, proposing solutions to technical challenges, and ensuring that the codebase remained clean and maintainable. My role required a deep understanding of JavaScript, TypeScript, React, browser APIs, and security principles, as well as the ability to communicate technical concepts clearly."),

      // Detailed Contributions
      h(1, "Detailed Technical Contributions"),
      h(2, "PDF Encryption Subsystem"),
      p("One of my most significant contributions was the development and hardening of the PDF encryption subsystem. The goal was to allow users to password-protect their PDFs and restrict actions such as printing, copying content, and modifying the document. Initially, the encryption feature appeared to work at a surface level because documents could be saved with password protection. However, testing revealed a critical issue: even when permissions were disabled, users could still print the document after entering the password."),
      p("I investigated the root cause and discovered that in PDF security, if the owner password is identical to the user password, many PDF viewers treat the user as the document owner and grant full permissions, effectively ignoring the permission restrictions. This is a subtle but important behavior of the PDF specification. To fix this, I implemented logic that ensures the owner password is always different from the user password. When no separate owner password is provided, the system generates a cryptographically random owner password so that the user, opening the file with their chosen password, receives only the restricted permissions defined by the application."),
      p("I also hardened the permission flags passed to pdf-lib. Instead of relying on default values, I explicitly set printing, copying, modifying, annotating, filling forms, and document assembly permissions based on the user\u2019s selected options. For example, when printing is disabled, the code passes printing: false rather than leaving the field undefined. This removes ambiguity and ensures consistent behavior across different PDF viewers."),
      p("To further improve reliability, I added a post-save verification step. After the encrypted PDF is saved, the code attempts to load the resulting bytes without providing a password. If the load succeeds, it indicates that encryption did not apply correctly, and an error is thrown. If the load fails with an encryption-related message, the verification passes, confirming that the file is genuinely protected. This defensive programming pattern catches silent failures that might otherwise leave users with unprotected documents."),
      p("I also improved error handling around the upload and persistence logic. Previously, if saving the output to the user\u2019s cloud library failed, the local download might be reported as a failure even when it succeeded. I restructured the code so that library persistence failures are isolated and reported separately, ensuring users always know whether their local download was successful. This improves the overall user experience and reduces confusion."),
      h(2, "Database and Architecture Discussions"),
      p("Throughout the project, I participated in discussions about database design and frontend-backend communication. I helped clarify which tables store user data, how files are recorded in the library, and how metadata should be structured to support the history feature. These discussions were important because a poorly designed schema would make it difficult to query user history, enforce security policies, or scale the application."),
      p("I also engaged with the principles of Row-Level Security, learning how to ensure that authenticated users can only access their own records. This involved understanding the relationship between the auth schema managed by Supabase and custom public schema tables such as profiles and user roles. I contributed to the decision to store user roles in a separate table rather than embedding them in the profile, following security best practices to prevent privilege escalation."),
      h(2, "Frontend-Backend Integration"),
      p("I worked on the integration between the React frontend and the Supabase backend. This included using the auto-generated Supabase client to perform queries, handle authentication state through the AuthContext, and upload processed files to Supabase Storage. I helped ensure that file uploads, metadata recording, and error reporting were handled consistently across the PDF, image, and audio tools."),
      p("A key part of this work was the saveOutput and saveBlob helper patterns, which first trigger a local download and then, if the user is authenticated, upload the file and record metadata. I refined error handling so that backend failures do not break the local download flow, maintaining a smooth user experience even when network or storage issues occur."),
      h(2, "Feature Lifecycle Management"),
      p("A crucial aspect of my role was making pragmatic decisions about feature quality. After multiple attempts to make the PDF encryption feature fully reliable, it became clear that browser-based PDF encryption had compatibility issues across different PDF viewers and clients. Some viewers respected the restrictions while others did not, leading to inconsistent user experiences. Rather than shipping a feature that might give users a false sense of security, I recommended and implemented the removal of the Encrypt tab from the PDF Tools interface."),
      p("This decision reflects a commitment to quality and user trust. It is better to exclude a feature than to provide one that behaves unpredictably with sensitive documents. I removed the EncryptPanel import, the corresponding tab trigger, and the tab content from the PdfTools page, ensuring that no broken or misleading functionality remained accessible to users."),

      // Challenges and Solutions
      h(1, "Challenges Faced and Solutions Implemented"),
      p("One of the major challenges in this project was the inherent inconsistency of browser-based file processing across different browsers, operating systems, and file formats. PDF viewers, for example, interpret encryption and permission flags differently, making it difficult to guarantee uniform behavior. The solution was to enforce stricter settings, add verification steps, and ultimately remove features that could not be made reliable."),
      p("Another challenge was managing large files and memory usage. Processing PDFs, images, and audio in the browser can consume significant memory. I addressed this by using efficient libraries, releasing object URLs when no longer needed, processing files asynchronously, and avoiding unnecessary re-renders through React memoization and careful state management."),
      p("Cross-cutting error handling was also a challenge. With many file operations happening in parallel and depending on both local computation and cloud services, errors could occur at multiple stages. I implemented a pattern where local operations and cloud persistence are wrapped in separate try-catch blocks, ensuring that failures in one area do not not cascade into others and that users receive clear, actionable feedback."),
      p("A related challenge was maintaining a consistent user experience while processing files. Since many operations can take several seconds for larger files, it was important to provide loading indicators, disable interactive elements during processing, and display meaningful success or error messages. I ensured that these patterns were applied consistently across the tool modules, helping users understand the state of the application at all times."),

      // Security and Privacy
      h(1, "Security and Privacy Considerations"),
      p("Security was a central concern throughout the project. The client-side processing model itself is a privacy advantage because files are not uploaded to servers unless the user explicitly chooses to save them. For authentication, the project uses Supabase\u2019s secure token-based system with proper session management."),
      p("For database access, Row-Level Security policies ensure that users can only read and modify their own data. User roles are stored in a dedicated table, and role checks are performed through security definer functions to avoid recursive policy issues. I contributed to these discussions and helped ensure that client-side code never relies on localStorage or hardcoded values for authorization decisions."),
      p("In the PDF encryption area, I implemented password separation, explicit permission flags, and post-save verification to maximize the reliability of the protection. Although the feature was eventually removed from the UI due to viewer inconsistencies, the underlying code reflects strong security practices and a defensive approach to file protection."),

      // Testing and QA
      h(1, "Testing and Quality Assurance"),
      p("The project uses Vitest for unit and integration testing, along with React Testing Library for component testing. TypeScript provides compile-time type safety, while ESLint enforces code style and catches common issues. During my work, I validated changes by reviewing build output, running tests, and manually verifying behavior in the application preview."),
      p("For PDF encryption, I tested the output by opening encrypted files in multiple viewers and checking whether the permission restrictions were honored. When inconsistencies were found, I iterated on the implementation until the issue was understood. This hands-on testing approach was essential because PDF viewer behavior cannot always be predicted from code alone."),

      // Learning Outcomes
      h(1, "Learning Outcomes and Professional Impact"),
      p("Working on PrismDocEditor significantly deepened my understanding of modern web development, browser APIs, and file processing techniques. I gained hands-on experience with React 18, TypeScript, Vite, Tailwind CSS, and shadcn/ui, and I learned how to build accessible, responsive interfaces using component libraries and utility-first CSS."),
      p("I also developed a stronger appreciation for security in client-side applications. The PDF encryption work taught me about password separation, permission flags, and the limitations of browser-based security. The database discussions enhanced my understanding of RLS, user roles, and secure frontend-backend integration."),
      p("Beyond technical skills, the project improved my ability to make pragmatic engineering decisions. Removing the Encrypt tab was a lesson in prioritizing user trust over feature count. I learned that shipping fewer, more reliable features is often better than shipping many features with unpredictable behavior."),
      p("Professionally, this project strengthened my ability to work independently on complex features, debug issues methodically, and communicate technical trade-offs clearly. It also gave me practical experience with the entire feature lifecycle, from initial implementation and testing to refinement and, when necessary, deprecation."),

      // Future Scope
      h(1, "Future Scope"),
      p("Looking ahead, PrismDocEditor has significant potential for expansion. Future enhancements could include support for additional file formats, batch processing of multiple files, cloud-based background processing for heavy operations, and integration with cloud storage providers such as Google Drive or Dropbox."),
      p("The PDF toolset could be extended with form creation, digital signature verification, and more advanced redaction features. The image tools could add filters, cropping, and AI-powered enhancements. The audio tools could introduce noise reduction, pitch shifting, and transcription services. With its solid foundation, the platform is well-positioned to grow into a comprehensive digital workspace."),
      p("On the infrastructure side, future work could include implementing edge functions for server-side validation, adding real-time collaboration features, and enhancing analytics to understand user behavior. These additions would further increase the value of the platform while maintaining its core commitment to privacy and performance."),

      // Conclusion
      h(1, "Conclusion"),
      p("PrismDocEditor represents a successful effort to build a unified, privacy-focused, browser-based platform for document, image, and audio processing. Through careful technology choices, a clean component architecture, and a strong emphasis on local processing, the application delivers a secure and responsive user experience. My contributions to the project, particularly in PDF encryption, database architecture discussions, frontend-backend integration, and feature quality decisions, played a meaningful role in shaping the final product."),
      p("The project reinforced the importance of combining technical depth with practical judgment. Whether hardening security logic, debugging complex file processing issues, or making tough calls about feature scope, I consistently focused on delivering value to users while maintaining high standards of quality. I am proud of the work done on PrismDocEditor and the skills I developed through the experience."),
    ]
  }]
});

const outputPath = '/mnt/documents/PrismDocEditor_Project_Report.docx';
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outputPath, buffer);
  console.log('Created:', outputPath);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
