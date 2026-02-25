# Contributing to BalanceBuddy

Thank you for your interest in contributing to BalanceBuddy! This document provides guidelines and information for contributors.

## 🤝 How to Contribute

### Reporting Issues

1. **Search existing issues** before creating a new one
2. Use clear and descriptive titles
3. Provide detailed information:
   - Steps to reproduce
   - Expected vs actual behavior
   - Device/OS information
   - Screenshots if applicable
4. Use appropriate labels and templates

### Feature Requests

1. Check if the feature already exists or is planned
2. Provide a clear description of the feature
3. Explain the use case and benefits
4. Consider implementation suggestions

## 🛠 Development Setup

### Prerequisites
- Node.js 16+ 
- npm or yarn
- Expo CLI
- Git

### Setup Steps
```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/BalanceBuddy.git
cd BalanceBuddy

# Install dependencies
npm install

# Create a feature branch
git checkout -b feature/your-feature-name

# Start development server
npm start
```

### Development Guidelines

#### Code Style
- Follow existing code style and patterns
- Use meaningful variable and function names
- Add comments for complex logic
- Keep components small and focused

#### File Structure
- Place new components in `src/components/`
- Screens go in `src/screens/`
- Constants in `src/constants/`
- Follow the existing folder structure

#### Git Conventions
- Use conventional commit messages:
  - `feat:` for new features
  - `fix:` for bug fixes
  - `docs:` for documentation
  - `style:` for code style changes
  - `refactor:` for code refactoring
  - `test:` for adding tests
  - `chore:` for maintenance tasks

Example:
```
feat: add currency converter screen
fix: resolve navigation crash on Android
docs: update API documentation
```

## 📝 Pull Request Process

### Before Submitting
1. **Test your changes** thoroughly on multiple platforms if possible
2. **Update documentation** if needed
3. **Add tests** for new functionality
4. **Ensure no console errors** or warnings
5. **Check responsive design** on different screen sizes

### PR Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] No merge conflicts
- [ ] App builds and runs successfully

### PR Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tested on iOS
- [ ] Tested on Android  
- [ ] Tested on Web
- [ ] Manual testing completed

## Screenshots (if applicable)
Add screenshots for UI changes

## Additional Notes
Any additional context or considerations
```

## 🐛 Bug Fix Guidelines

### Debugging Steps
1. Reproduce the issue consistently
2. Check console logs for errors
3. Test on different platforms/devices
4. Isolate the problematic code
5. Fix with minimal changes

### Testing Fixes
- Verify the fix resolves the issue
- Ensure no regressions introduced
- Test edge cases
- Get code review if possible

## ✨ Feature Development

### Planning
1. Create an issue to discuss the feature
2. Get feedback from maintainers
3. Break down into smaller tasks
4. Estimate complexity

### Implementation
1. Follow existing patterns and conventions
2. Make changes backwards compatible
3. Update relevant documentation
4. Add appropriate error handling

## 📱 Platform-Specific Considerations

### iOS
- Test on different iOS versions
- Follow Apple's design guidelines
- Handle iOS-specific permissions

### Android
- Test on various Android versions
- Follow Material Design principles
- Handle Android-specific permissions

### Web
- Ensure responsive design
- Test on different browsers
- Consider accessibility

## 🔧 Code Review Process

### Reviewer Guidelines
- Check for code quality and style
- Verify functionality and logic
- Test the changes if possible
- Provide constructive feedback

### Author Responsibilities
- Address review comments promptly
- Explain complex decisions
- Update based on feedback
- Be open to suggestions

## 📚 Resources

### Documentation
- [React Native Docs](https://reactnative.dev/)
- [Expo Documentation](https://docs.expo.dev/)
- [Firebase Documentation](https://firebase.google.com/docs)

### Tools
- [Expo Snack](https://snack.expo.dev/) for quick testing
- [Reactotron](https://github.com/infinitered/reactotron) for debugging
- [Flipper](https://fbflipper.com/) for advanced debugging

## 🎯 Good First Issues

Look for issues labeled `good first issue` for beginner-friendly contributions:
- Documentation improvements
- Bug fixes with clear reproduction steps
- Small UI enhancements
- Code refactoring

## 💬 Getting Help

- Create an issue for questions
- Join discussions in existing issues
- Check documentation first
- Be patient and respectful

## 🏆 Recognition

Contributors are recognized in:
- README.md contributors section
- Release notes
- Special contributor badges (future)

Thank you for contributing to BalanceBuddy! Your contributions help make expense tracking better for everyone. 🚀
