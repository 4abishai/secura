package com.secura.Service;

import com.secura.entity.User;
import com.secura.repository.UserRepository;
import com.secura.DTO.LoginResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.Optional;

@Service
@Transactional
public class AuthenticationService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private BCryptPasswordEncoder passwordEncoder;

    private static final Logger logger = LoggerFactory.getLogger(AuthenticationService.class);

    /**
     * Simple authentication - just check username and password
     */
    public LoginResponse authenticateUser(String username, String password) {
        try {
            // Validate input
            if (username == null || username.trim().isEmpty()) {
                return new LoginResponse(false, "Username is required");
            }

            if (password == null || password.trim().isEmpty()) {
                return new LoginResponse(false, "Password is required");
            }

            // Find user by username
            Optional<User> userOptional = userRepository.findByUsername(username);

            if (userOptional.isEmpty()) {
                logger.warn("Login attempt with non-existent username: {}", username);
                return new LoginResponse(false, "Invalid username or password");
            }

            User user = userOptional.get();

            // Check password
            if (passwordEncoder.matches(password, user.getPassword())) {
                // Update user online status
                user.setOnline(true);
                user.setLastSeen(System.currentTimeMillis());
                userRepository.save(user);

                logger.info("Successful login for user: {}", user.getUsername());
                return new LoginResponse(true, "Login successful", user.getUsername());
            } else {
                logger.warn("Failed login attempt for user: {}", user.getUsername());
                return new LoginResponse(false, "Invalid username or password");
            }

        } catch (Exception e) {
            logger.error("Error during authentication", e);
            return new LoginResponse(false, "Authentication failed");
        }
    }

    /**
     * Simple method to check credentials - returns true/false
     */
    public boolean isValidUser(String username, String password) {
        LoginResponse response = authenticateUser(username, password);
        return response.isSuccess();
    }

    /**
     * Get user by username
     */
    public Optional<User> getUserByUsername(String username) {
        return userRepository.findByUsername(username);
    }

    /**
     * Get user details for session
     */
    public User getUserDetails(String username) {
        return userRepository.findByUsername(username).orElse(null);
    }

    /**
     * Update user offline status
     */
    public void setUserOffline(String username) {
        Optional<User> userOptional = userRepository.findByUsername(username);
        if (userOptional.isPresent()) {
            User user = userOptional.get();
            user.setOnline(false);
            user.setLastSeen(System.currentTimeMillis());
            userRepository.save(user);
        }
    }
}